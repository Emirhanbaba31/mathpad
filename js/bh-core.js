// MathPad Kara Delik Fizik Çekirdeği (Part 1 of 4)
// Saf ES modülü (DOM yok, ui.js / fx.js / phys-ui.js bağımlılığı yok; node testlerinde doğrudan çalışır).
// SI birimleri dış arayüzde, geometrik birimler (G = c = 1, uzunluk birimi M = GM/c²) GR integratörlerinde kullanılır.

// =====================================================================
// 1. FİZİKSEL SABİTLER VE BİRİM DÖNÜŞÜM YARDIMCILARI
// =====================================================================

/** Evrensel kütleçekim sabiti G [m³ kg⁻¹ s⁻²] (CODATA 2018). */
export const G = 6.67430e-11;
/** Vakumda ışık hızı c [m s⁻¹] (kesin SI tanımı). */
export const C = 299792458;
/** Güneş kütlesi M☉ [kg]. */
export const M_SUN = 1.98847e30;
/** İndirgenmiş Planck sabiti ħ [J s]. */
export const HBAR = 1.054571817e-34;
/** Planck sabiti h = 2πħ [J s]. */
export const H_PLANCK = 2 * Math.PI * HBAR;
/** Boltzmann sabiti k_B [J K⁻¹] (kesin SI tanımı). */
export const K_B = 1.380649e-23;
/** Stefan-Boltzmann sabiti σ_SB [W m⁻² K⁻⁴]. */
export const SIGMA_SB = 5.670374419e-8;
/** 1 parsek [m]. */
export const PARSEC = 3.0857e16;
/** 1 kiloparsek [m]. */
export const KPC = 1e3 * PARSEC;
/** 1 megaparsek [m]. */
export const MPC = 1e6 * PARSEC;
/** 1 Jülyen yılı (365,25 gün) [s]. */
export const YEAR = 3.15576e7;
/** 1 astronomik birim (AU) [m]. */
export const AU = 1.495978707e11;
/** 1 ışık yılı [m]. */
export const LIGHT_YEAR = C * YEAR;
/** Proton kütlesi m_p [kg]. */
export const M_PROTON = 1.67262192369e-27;
/** Thomson saçılma tesir kesiti σ_T [m²]. */
export const SIGMA_T = 6.6524587321e-29;
/** Wien yer değiştirme sabiti b [m K]. */
export const WIEN_B = 2.897771955e-3;
/** Standart yerçekimi ivmesi g₀ [m s⁻²]. */
export const G0 = 9.80665;
/** Evrenin yaşı (Planck 2018: 13,787 milyar yıl) [s]. */
export const AGE_OF_UNIVERSE = 13.787e9 * YEAR;
/** Dünya kütlesi M⊕ [kg]. */
export const M_EARTH = 5.97219e24;
/** Dünya ortalama yarıçapı R⊕ [m]. */
export const R_EARTH = 6.371e6;
/** Güneş yarıçapı R☉ [m]. */
export const R_SUN = 6.957e8;
/** Radyandan yay saniyesine dönüşüm çarpanı [arcsec rad⁻¹]. */
export const RAD_TO_ARCSEC = (180 / Math.PI) * 3600;
/** Yay saniyesinden radyana dönüşüm çarpanı [rad arcsec⁻¹]. */
export const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
/** Radyandan mikroyay saniyesine dönüşüm çarpanı [μas rad⁻¹]. */
export const RAD_TO_UAS = RAD_TO_ARCSEC * 1e6;
/** Mikroyay saniyesinden radyana dönüşüm çarpanı [rad μas⁻¹]. */
export const UAS_TO_RAD = ARCSEC_TO_RAD * 1e-6;

/** Tüm temel fiziksel sabitleri tek nesnede toplar (SI birimleri). */
export const CONSTANTS = Object.freeze({
  G, C, M_SUN, HBAR, H_PLANCK, K_B, SIGMA_SB, PARSEC, KPC, MPC, YEAR, AU,
  LIGHT_YEAR, M_PROTON, SIGMA_T, WIEN_B, G0, AGE_OF_UNIVERSE, M_EARTH, R_EARTH,
  R_SUN, RAD_TO_ARCSEC, ARCSEC_TO_RAD, RAD_TO_UAS, UAS_TO_RAD,
});

const C2 = C * C;
const C3 = C2 * C;
const C4 = C2 * C2;
const C6 = C3 * C3;
const SQRT3 = Math.sqrt(3);
const B_CRIT_GEOM = 3 * SQRT3;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/** Kilogram kütleyi Güneş kütlesine (M☉) çevirir: (kg [kg]) -> [M☉]. */
export const kgToSolarMass = kg => kg / M_SUN;
/** Güneş kütlesini (M☉) kilograma çevirir: (solarMasses [M☉]) -> [kg]. */
export const solarMassToKg = solarMasses => solarMasses * M_SUN;
/** Metreyi kilometreye çevirir: (meters [m]) -> [km]. */
export const mToKm = meters => meters * 1e-3;
/** Kilometreyi metreye çevirir: (km [km]) -> [m]. */
export const kmToM = km => km * 1e3;
/** Saniyeyi Jülyen yılına çevirir: (seconds [s]) -> [yr]. */
export const secToYears = seconds => seconds / YEAR;
/** Jülyen yılını saniyeye çevirir: (years [yr]) -> [s]. */
export const yearsToSec = years => years * YEAR;
/** Metreyi parseke çevirir: (meters [m]) -> [pc]. */
export const mToPc = meters => meters / PARSEC;
/** Parseki metreye çevirir: (pc [pc]) -> [m]. */
export const pcToM = pc => pc * PARSEC;
/** Metreyi kiloparseke çevirir: (meters [m]) -> [kpc]. */
export const mToKpc = meters => meters / KPC;
/** Kiloparseki metreye çevirir: (kpc [kpc]) -> [m]. */
export const kpcToM = kpc => kpc * KPC;
/** Metreyi megaparseke çevirir: (meters [m]) -> [Mpc]. */
export const mToMpc = meters => meters / MPC;
/** Megaparseki metreye çevirir: (mpc [Mpc]) -> [m]. */
export const mpcToM = mpc => mpc * MPC;
/** Radyanı yay saniyesine çevirir: (rad [rad]) -> [arcsec]. */
export const radToArcsec = rad => rad * RAD_TO_ARCSEC;
/** Yay saniyesini radyana çevirir: (arcsec [arcsec]) -> [rad]. */
export const arcsecToRad = arcsec => arcsec * ARCSEC_TO_RAD;
/** Radyanı mikroyay saniyesine çevirir: (rad [rad]) -> [μas]. */
export const radToUas = rad => rad * RAD_TO_UAS;
/** Mikroyay saniyesini radyana çevirir: (uas [μas]) -> [rad]. */
export const uasToRad = uas => uas * UAS_TO_RAD;
/** Yay saniyesini mikroyay saniyesine çevirir: (arcsec [arcsec]) -> [μas]. */
export const arcsecToUas = arcsec => arcsec * 1e6;
/** Mikroyay saniyesini yay saniyesine çevirir: (uas [μas]) -> [arcsec]. */
export const uasToArcsec = uas => uas * 1e-6;

/** Kütleçekim yarıçapı (geometrik uzunluk birimi) r_g = GM/c²: (massKg [kg]) -> [m]. */
export const gravRadius = massKg => (G * massKg) / C2;
/** Kütleçekim zaman ölçeği (geometrik zaman birimi) t_g = GM/c³: (massKg [kg]) -> [s]. */
export const gravTime = massKg => (G * massKg) / C3;
/** Geometrik uzunluğu (M biriminde) metreye çevirir: (rGeom [M], massKg [kg]) -> [m]. */
export const geomToMeters = (rGeom, massKg) => rGeom * gravRadius(massKg);
/** Metreyi geometrik uzunluğa (M birimine) çevirir: (rMeters [m], massKg [kg]) -> [M]. */
export const metersToGeom = (rMeters, massKg) => rMeters / gravRadius(massKg);
/** Geometrik zamanı (M biriminde) saniyeye çevirir: (tGeom [M], massKg [kg]) -> [s]. */
export const geomToSeconds = (tGeom, massKg) => tGeom * gravTime(massKg);
/** Saniyeyi geometrik zamana (M birimine) çevirir: (tSeconds [s], massKg [kg]) -> [M]. */
export const secondsToGeom = (tSeconds, massKg) => tSeconds / gravTime(massKg);

const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Tam sayıyı Unicode üst indis dizesine çevirir: (n [int]) -> string (örn. -6 -> '⁻⁶'). */
export function toSuperscript(n) {
  const s = String(Math.trunc(n));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += ch === '-' ? '⁻' : ch === '+' ? '' : SUP_DIGITS[+ch] ?? ch;
  }
  return out;
}

/** Gerçel sayıyı Türkçe ondalık virgül ile biçimlendirir: (x, digits=2) -> string (örn. 12,34). */
export function formatNumTR(x, digits = 2) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const neg = x < 0;
  const s = Math.abs(x).toFixed(digits).replace('.', ',');
  return neg ? `−${s}` : s;
}

/** Sayıyı Türkçe bilimsel gösterimde biçimlendirir: (x, digits=2, opts?) -> string (örn. '1,23 × 10⁶'). */
export function formatSciTR(x, digits = 2, { forceSci = false, minExp = -3, maxExp = 4 } = {}) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const neg = x < 0;
  const ax = Math.abs(x);
  const expStr = ax.toExponential(digits);
  const [mantRaw, eRaw] = expStr.split('e');
  const exp = parseInt(eRaw, 10);
  if (!forceSci && exp >= minExp && exp < maxExp) {
    const dec = Math.max(0, digits - Math.max(0, exp));
    const plain = Number(ax.toFixed(dec)).toFixed(dec).replace('.', ',');
    return neg ? `−${plain}` : plain;
  }
  const mant = mantRaw.replace('.', ',');
  return `${neg ? '−' : ''}${mant} × 10${toSuperscript(exp)}`;
}

// =====================================================================
// 2. SCHWARZSCHILD KARA DELİĞİ
// =====================================================================

/** Schwarzschild yarıçapı (olay ufku) r_s = 2GM/c²: (massKg [kg]) -> [m]. */
export function schwarzschildRadius(massKg) {
  return (2 * G * massKg) / C2;
}

/** Foton küresi yarıçapı r_ph = 3GM/c²: (massKg [kg]) -> [m]. */
export function photonSphereRadius(massKg) {
  return (3 * G * massKg) / C2;
}

/** Schwarzschild en içteki kararlı dairesel yörünge (ISCO) yarıçapı 6GM/c²: (massKg [kg]) -> [m]. */
export function schwarzschildIsco(massKg) {
  return (6 * G * massKg) / C2;
}

/** Marjinal bağlı dairesel yörünge yarıçapı r_mb = 4GM/c²: (massKg [kg]) -> [m]. */
export function marginallyBoundRadius(massKg) {
  return (4 * G * massKg) / C2;
}

/** Kara delik gölge yarıçapı (kritik çarpışma parametresi) b_c = 3√3 GM/c²: (massKg [kg]) -> [m]. */
export function shadowRadius(massKg) {
  return B_CRIT_GEOM * gravRadius(massKg);
}

/** Uzak gözlemcinin gördüğü kara delik gölge açısal çapı θ = 2 b_c / D: (massKg [kg], distanceM [m]) -> [rad]. */
export function shadowAngularDiameter(massKg, distanceM) {
  return (2 * shadowRadius(massKg)) / distanceM;
}

/** Olay ufku hacmine göre ortalama yoğunluk ρ̄ = M / (4/3 π r_s³): (massKg [kg]) -> [kg m⁻³]. */
export function blackHoleMeanDensity(massKg) {
  const rs = schwarzschildRadius(massKg);
  return massKg / ((4 / 3) * Math.PI * rs * rs * rs);
}

/** Schwarzschild yüzey kütleçekimi κ = c⁴ / (4GM): (massKg [kg]) -> [m s⁻²]. */
export function surfaceGravity(massKg) {
  return C4 / (4 * G * massKg);
}

/** Yerel statik gözlemcinin r yarıçapında ölçtüğü kaçış hızı v_esc = √(2GM/r) (r = r_s'de c): (massKg [kg], rMeters [m]) -> [m s⁻¹]. */
export function escapeVelocity(massKg, rMeters) {
  const rs = schwarzschildRadius(massKg);
  if (!(rMeters > 0) || rMeters < rs) return NaN;
  if (rMeters === rs) return C;
  return C * Math.sqrt(rs / rMeters);
}

/** Verilen kütle (ve isteğe bağlı uzaklık) için temel Schwarzschild büyüklüklerinin özeti: (massKg [kg], distanceM? [m]) -> object. */
export function schwarzschildSummary(massKg, distanceM = null) {
  const rg = gravRadius(massKg);
  const rs = 2 * rg;
  const rPh = 3 * rg;
  const rMb = 4 * rg;
  const rIsco = 6 * rg;
  const bc = B_CRIT_GEOM * rg;
  const shadowRad = distanceM > 0 ? (2 * bc) / distanceM : null;
  return {
    massKg,
    massSolar: kgToSolarMass(massKg),
    gravRadius: rg,
    schwarzschildRadius: rs,
    photonSphereRadius: rPh,
    marginallyBoundRadius: rMb,
    iscoRadius: rIsco,
    shadowRadius: bc,
    shadowAngularRad: shadowRad,
    shadowAngularUas: shadowRad !== null ? radToUas(shadowRad) : null,
    meanDensity: blackHoleMeanDensity(massKg),
    surfaceGravity: surfaceGravity(massKg),
  };
}

// =====================================================================
// 3. SAATLER, IŞIK VE RADYAL SERBEST DÜŞÜŞ (SCHWARZSCHILD)
// =====================================================================

/** Statik gözlemci zaman genişlemesi dτ/dt = √(1 - r_s/r): (massKg [kg], rMeters [m]) -> boyutsuz oran. */
export function staticTimeDilation(massKg, rMeters) {
  const rs = schwarzschildRadius(massKg);
  if (!(rMeters >= rs)) return NaN;
  if (rMeters === rs) return 0;
  return Math.sqrt(1 - rs / rMeters);
}

/** Dairesel yörüngedeki gözlemci zaman genişlemesi dτ/dt = √(1 - 3GM/(c²r)): (massKg [kg], rMeters [m]) -> boyutsuz oran. */
export function circularOrbitTimeDilation(massKg, rMeters) {
  const rPh = photonSphereRadius(massKg);
  if (!(rMeters >= rPh)) return NaN;
  if (rMeters === rPh) return 0;
  return Math.sqrt(1 - rPh / rMeters);
}

/** Statik kaynaktan uzak gözlemciye kütleçekimsel kırmızıya kayma çarpanı 1 + z = 1/√(1 - r_s/r): (massKg [kg], rMeters [m]) -> boyutsuz. */
export function gravitationalRedshiftFactor(massKg, rMeters) {
  const rs = schwarzschildRadius(massKg);
  if (!(rMeters >= rs)) return NaN;
  if (rMeters === rs) return Infinity;
  return 1 / Math.sqrt(1 - rs / rMeters);
}

/** Statik kaynaktan uzak gözlemciye kütleçekimsel kırmızıya kayma z = 1/√(1 - r_s/r) - 1: (massKg [kg], rMeters [m]) -> boyutsuz. */
export function gravitationalRedshift(massKg, rMeters) {
  const f = gravitationalRedshiftFactor(massKg, rMeters);
  return Number.isFinite(f) ? f - 1 : f;
}

/** Dairesel yörüngedeki parçacığın yerel statik gözlemci tarafından ölçülen hızı v = √(GM/(r - r_s)) (ISCO'da c/2, foton küresinde c): (massKg [kg], rMeters [m]) -> [m s⁻¹]. */
export function circularOrbitSpeed(massKg, rMeters) {
  const rs = schwarzschildRadius(massKg);
  const rPh = 1.5 * rs;
  if (!(rMeters >= rPh)) return NaN;
  if (rMeters === rPh) return C;
  return Math.sqrt((G * massKg) / (rMeters - rs));
}

/** Dairesel yörüngenin koordinat periyodu, öz periyodu ve açısal hızı: (massKg [kg], rMeters [m]) -> { coordPeriod [s], properPeriod [s], omega [rad s⁻¹] }. */
export function circularOrbitPeriod(massKg, rMeters) {
  const rPh = photonSphereRadius(massKg);
  if (!(rMeters > rPh)) return { coordPeriod: NaN, properPeriod: NaN, omega: NaN };
  const omega = Math.sqrt((G * massKg) / (rMeters * rMeters * rMeters));
  const coordPeriod = (2 * Math.PI) / omega;
  const properPeriod = coordPeriod * circularOrbitTimeDilation(massKg, rMeters);
  return { coordPeriod, properPeriod, omega };
}

/** Dairesel yörüngedeki yayıcıdan uzak gözlemciye birleşik (kütleçekimsel + Doppler) kırmızıya kayma (angleRad: foton yönü ile yörünge hızı arasındaki yerel statik çerçeve açısı, 0=yaklaşan, π/2=enine, π=uzaklaşan): (massKg [kg], rMeters [m], angleRad? [rad]) -> { z, onePlusZ, gFactor, gravFactor, dopplerFactor, beta }. */
export function circularOrbitRedshift(massKg, rMeters, angleRad = Math.PI / 2) {
  const rPh = photonSphereRadius(massKg);
  if (!(rMeters > rPh)) {
    return { z: NaN, onePlusZ: NaN, gFactor: NaN, gravFactor: NaN, dopplerFactor: NaN, beta: NaN };
  }
  const rs = schwarzschildRadius(massKg);
  const beta = circularOrbitSpeed(massKg, rMeters) / C;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const gravFactor = 1 / Math.sqrt(1 - rs / rMeters);
  const dopplerFactor = gamma * (1 - beta * Math.cos(angleRad));
  const onePlusZ = (1 - beta * Math.cos(angleRad)) / Math.sqrt(1 - rPh / rMeters);
  return {
    z: onePlusZ - 1,
    onePlusZ,
    gFactor: 1 / onePlusZ,
    gravFactor,
    dopplerFactor,
    beta,
  };
}

/** Olay ufkundan durgun halde serbest bırakılan gözlemcinin tekilliğe (r = 0) ulaşması için azami öz süre τ_max = πGM/c³: (massKg [kg]) -> [s]. */
export function maxInteriorFallTime(massKg) {
  return Math.PI * gravTime(massKg);
}

/** r0'dan durgun halde başlayan radyal serbest düşüşün kapalı form sikloid çözümü (rMeters ∈ [0, r0Meters]): (massKg [kg], r0Meters [m], rMeters [m]) -> { eta [rad], properTime [s], coordTime [s], drDtau [m s⁻¹], localSpeed [m s⁻¹], timeToHorizon [s], timeToSingularity [s], horizonToSingularity [s] }. */
export function radialFreeFall(massKg, r0Meters, rMeters) {
  const rs = schwarzschildRadius(massKg);
  if (!(r0Meters >= rs) || !(rMeters >= 0) || rMeters > r0Meters) {
    return {
      eta: NaN, properTime: NaN, coordTime: NaN, drDtau: NaN, localSpeed: NaN,
      timeToHorizon: NaN, timeToSingularity: NaN, horizonToSingularity: NaN,
    };
  }
  const scaleTau = Math.sqrt((r0Meters * r0Meters * r0Meters) / (8 * G * massKg));
  const eta = 2 * Math.acos(clamp(Math.sqrt(rMeters / r0Meters), 0, 1));
  const properTime = scaleTau * (eta + Math.sin(eta));
  const timeToSingularity = Math.PI * scaleTau;
  const etaH = 2 * Math.acos(clamp(Math.sqrt(rs / r0Meters), 0, 1));
  const timeToHorizon = scaleTau * (etaH + Math.sin(etaH));
  const horizonToSingularity = timeToSingularity - timeToHorizon;

  const drDtau = rMeters === 0 ? -Infinity : -Math.sqrt(2 * G * massKg * (1 / rMeters - 1 / r0Meters));
  let coordTime = Infinity;
  let localSpeed = NaN;
  if (r0Meters > rs && rMeters > rs) {
    const A = Math.sqrt(r0Meters / rs - 1);
    const u = Math.tan(eta / 2);
    const logTerm = Math.log((A + u) / (A - u));
    const polyTerm = A * (eta + (r0Meters / (2 * rs)) * (eta + Math.sin(eta)));
    coordTime = (rs / C) * (logTerm + polyTerm);
    const E = Math.sqrt(1 - rs / r0Meters);
    const f = 1 - rs / rMeters;
    localSpeed = C * Math.sqrt(Math.max(0, 1 - f / (E * E)));
  } else if (rMeters === r0Meters && r0Meters > rs) {
    coordTime = 0;
    localSpeed = 0;
  } else if (rMeters === rs) {
    localSpeed = C;
  }

  return {
    eta,
    properTime,
    coordTime,
    drDtau,
    localSpeed,
    timeToHorizon,
    timeToSingularity,
    horizonToSingularity,
  };
}

/** r0'dan r = 0'a radyal serbest düşüş eğrisini sikloid parametresi üzerinden örnekler: (massKg [kg], r0Meters [m], steps=200) -> Array<{ eta, r, properTime, coordTime }>. */
export function radialFreeFallCurve(massKg, r0Meters, steps = 200) {
  const rs = schwarzschildRadius(massKg);
  if (!(r0Meters > rs) || steps < 2) return [];
  const scaleTau = Math.sqrt((r0Meters * r0Meters * r0Meters) / (8 * G * massKg));
  const A = Math.sqrt(r0Meters / rs - 1);
  const etaH = 2 * Math.acos(Math.sqrt(rs / r0Meters));
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const eta = (Math.PI * i) / steps;
    const r = 0.5 * r0Meters * (1 + Math.cos(eta));
    const properTime = scaleTau * (eta + Math.sin(eta));
    let coordTime = Infinity;
    if (eta < etaH - 1e-12) {
      const u = Math.tan(eta / 2);
      coordTime = (rs / C) * (Math.log((A + u) / (A - u)) + A * (eta + (r0Meters / (2 * rs)) * (eta + Math.sin(eta))));
    }
    out.push({ eta, r, properTime, coordTime });
  }
  return out;
}

// =====================================================================
// 4. SCHWARZSCHILD JEODEZİKLERİ (GEOMETRİK BİRİMLER, M = 1)
// =====================================================================

/** Kütleli parçacık için Schwarzschild etkin potansiyeli V(r) = (1 - 2/r)(1 + L²/r²) (M = 1): (r [M], L [M]) -> boyutsuz V_eff. */
export function effectivePotentialMassive(r, L) {
  if (!(r > 0)) return NaN;
  return (1 - 2 / r) * (1 + (L * L) / (r * r));
}

/** Işık (sıfır jeodezik) için Schwarzschild etkin potansiyeli V_null(r) = (1 - 2/r) L²/r² (M = 1, varsayılan L = 1): (r [M], L=1) -> boyutsuz V_null. */
export function effectivePotentialNull(r, L = 1) {
  if (!(r > 0)) return NaN;
  return (1 - 2 / r) * ((L * L) / (r * r));
}

/** Geometrik birimlerde (M = 1) r yarıçaplı dairesel parçacık yörüngesinin enerji, açısal momentum ve kararlılık parametreleri: (r [M]) -> { r, E, L, omega, d2Vdr2, stable, bound, regime }. */
export function circularOrbitParams(r) {
  if (!(r > 3)) {
    return { r, E: NaN, L: NaN, omega: NaN, d2Vdr2: NaN, stable: false, bound: false, regime: 'invalid' };
  }
  const L = r / Math.sqrt(r - 3);
  const E = (r - 2) / Math.sqrt(r * (r - 3));
  const omega = Math.pow(r, -1.5);
  const d2Vdr2 = (2 * (r - 6)) / (r * r * r * (r - 3));
  const stable = r >= 6;
  const bound = r > 4;
  let regime;
  if (r > 6) regime = 'stable';
  else if (r === 6) regime = 'isco';
  else if (r > 4) regime = 'unstable-bound';
  else if (r === 4) regime = 'marginally-bound';
  else regime = 'unstable-unbound';
  return { r, E, L, omega, d2Vdr2, stable, bound, regime };
}

/** Darwin (p, e) parametrelemesiyle bağlı Schwarzschild yörüngesinin tam (E, L, rPeri, rApo) değerleri (M = 1, kararlılık sınırı p > 6 + 2e): (p [M], e [0..1)) -> { p, e, rPeri, rApo, L, E, bound, valid }. */
export function boundOrbitParams(p, e) {
  if (!(p > 0) || !(e >= 0 && e < 1)) {
    return { p, e, rPeri: NaN, rApo: NaN, L: NaN, E: NaN, bound: false, valid: false };
  }
  const denom = p - 3 - e * e;
  const valid = p > 6 + 2 * e && denom > 0;
  const rPeri = p / (1 + e);
  const rApo = p / (1 - e);
  if (!(denom > 0)) {
    return { p, e, rPeri, rApo, L: NaN, E: NaN, bound: false, valid: false };
  }
  const L = p / Math.sqrt(denom);
  const E2 = ((p - 2 - 2 * e) * (p - 2 + 2 * e)) / (p * denom);
  const E = E2 > 0 ? Math.sqrt(E2) : NaN;
  return { p, e, rPeri, rApo, L, E, bound: E < 1, valid };
}

function rk4StepU(u, v, h, invL2) {
  const k1u = v;
  const k1v = invL2 - u + 3 * u * u;
  const u2 = u + 0.5 * h * k1u;
  const v2 = v + 0.5 * h * k1v;
  const k2u = v2;
  const k2v = invL2 - u2 + 3 * u2 * u2;
  const u3 = u + 0.5 * h * k2u;
  const v3 = v + 0.5 * h * k2v;
  const k3u = v3;
  const k3v = invL2 - u3 + 3 * u3 * u3;
  const u4 = u + h * k3u;
  const v4 = v + h * k3v;
  const k4u = v4;
  const k4v = invL2 - u4 + 3 * u4 * u4;
  return [
    u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u),
    v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ];
}

function bisectCrossingU(uStart, vStart, hFull, invL2, targetU, mode = 'u') {
  let lo = 0;
  let hi = hFull;
  const evalFn = h => {
    const [un, vn] = rk4StepU(uStart, vStart, h, invL2);
    return mode === 'u' ? un - targetU : vn;
  };
  const fLo = evalFn(lo);
  for (let i = 0; i < 52; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = evalFn(mid);
    if ((fLo <= 0 && fMid <= 0) || (fLo >= 0 && fMid >= 0)) lo = mid;
    else hi = mid;
    if (hi - lo <= 1e-14 * Math.max(1, Math.abs(hFull))) break;
  }
  const hBest = 0.5 * (lo + hi);
  const [uBest, vBest] = rk4StepU(uStart, vStart, hBest, invL2);
  return { dh: hBest, u: uBest, v: vBest };
}

/** Ekvatoryal kütleli parçacık yörüngesini u = 1/r cinsinden RK4 ile bütünleştirir (d²u/dφ² = 1/L² - u + 3u², M = 1): (opts: { r0, u0?, L, drDtau0?, duDphi0?, phi0?, dphi?, maxPhi?, rMax?, maxSteps?, sampleStride? }) -> { points, status, E0, EDriftMax, L, rMin, rMax, phiFinal, periapses }. */
export function integrateTimelikeOrbit({
  r0 = 10,
  u0 = undefined,
  L,
  drDtau0 = 0,
  duDphi0 = undefined,
  phi0 = 0,
  dphi = 0.005,
  maxPhi = 6 * Math.PI,
  rMax = 1e4,
  maxSteps = 200000,
  sampleStride = 1,
} = {}) {
  const invL2 = 1 / (L * L);
  let u = u0 !== undefined ? u0 : 1 / r0;
  let v = duDphi0 !== undefined ? duDphi0 : -drDtau0 / L;
  let phi = phi0;
  const energyOf = (uu, vv) => Math.sqrt(Math.max(0, L * L * vv * vv + (1 - 2 * uu) * (1 + L * L * uu * uu)));
  const E0 = energyOf(u, v);
  const uEscape = 1 / rMax;
  const stride = Math.max(1, Math.floor(sampleStride));

  const points = [];
  const pushPoint = (ph, uu, vv) => {
    const rr = uu > 0 ? 1 / uu : Infinity;
    points.push({
      phi: ph,
      r: rr,
      u: uu,
      du: vv,
      x: Number.isFinite(rr) ? rr * Math.cos(ph) : Infinity,
      y: Number.isFinite(rr) ? rr * Math.sin(ph) : Infinity,
      E: energyOf(uu, vv),
    });
  };
  pushPoint(phi, u, v);

  let status = 'bound';
  let EDriftMax = 0;
  let rMin = 1 / u;
  let rMaxSeen = rMin;
  const periapses = [];

  for (let step = 1; step <= maxSteps && phi - phi0 < maxPhi; step++) {
    const h = Math.min(dphi, phi0 + maxPhi - phi);
    const [un, vn] = rk4StepU(u, v, h, invL2);

    // Periapsis (u yerel maksimum, du/dphi: + -> -)
    if (v > 0 && vn <= 0) {
      const hit = bisectCrossingU(u, v, h, invL2, 0, 'v');
      periapses.push(phi + hit.dh);
      if (hit.u > 0 && 1 / hit.u < rMin) rMin = 1 / hit.u;
    }

    // Olay ufkuna yakalanma (u >= 0.5 -> r <= 2M)
    if (un >= 0.5) {
      const hit = bisectCrossingU(u, v, h, invL2, 0.5, 'u');
      phi += hit.dh;
      u = hit.u;
      v = hit.v;
      rMin = 2;
      pushPoint(phi, u, v);
      status = 'captured';
      break;
    }

    // Sonsuza kaçış (u <= uEscape ve dışa doğru hareket)
    if (un <= 0 || (un <= uEscape && vn < 0)) {
      const target = un <= 0 ? 0 : uEscape;
      const hit = bisectCrossingU(u, v, h, invL2, target, 'u');
      phi += hit.dh;
      u = hit.u;
      v = hit.v;
      if (u > 0 && 1 / u > rMaxSeen) rMaxSeen = 1 / u;
      pushPoint(phi, u, v);
      status = 'escaped';
      break;
    }

    phi += h;
    u = un;
    v = vn;
    const rr = 1 / u;
    if (rr < rMin) rMin = rr;
    if (rr > rMaxSeen) rMaxSeen = rr;
    const drift = Math.abs(energyOf(u, v) - E0);
    if (drift > EDriftMax) EDriftMax = drift;

    if (step % stride === 0 || phi - phi0 >= maxPhi - 1e-12) {
      pushPoint(phi, u, v);
    }
  }

  return {
    points,
    status,
    E0,
    EDriftMax,
    L,
    rMin,
    rMax: rMaxSeen,
    phiFinal: phi,
    periapses,
  };
}

/** Ekvatoryal ışık ışınını (sıfır jeodezik) u = 1/r cinsinden RK4 ile bütünleştirir (d²u/dφ² = -u + 3u², M = 1): (opts: { b, r0?, phi0?, outward?, dphi?, maxPhi?, rMax?, maxSteps?, sampleStride? }) -> { points, status, b, bCrit, captured, rMin, deflection, phiFinal }. */
export function integrateNullGeodesic({
  b,
  r0 = Infinity,
  phi0 = 0,
  outward = false,
  dphi = 0.004,
  maxPhi = 16 * Math.PI,
  rMax = null,
  maxSteps = 200000,
  sampleStride = 1,
} = {}) {
  const absB = Math.abs(b);
  if (!(absB > 0)) {
    return {
      points: [], status: 'captured', b, bCrit: B_CRIT_GEOM, captured: true,
      rMin: 2, deflection: Infinity, phiFinal: phi0,
    };
  }
  const uStart = Number.isFinite(r0) && r0 > 0 ? 1 / r0 : 0;
  const invB2 = 1 / (absB * absB);
  const radTerm = invB2 - uStart * uStart * (1 - 2 * uStart);
  if (radTerm < 0) {
    return {
      points: [], status: 'invalid', b, bCrit: B_CRIT_GEOM, captured: false,
      rMin: r0, deflection: NaN, phiFinal: phi0,
    };
  }
  let u = uStart;
  let v = (outward ? -1 : 1) * Math.sqrt(radTerm);
  let phi = phi0;
  const uEscape = rMax && Number.isFinite(rMax) ? 1 / rMax : uStart;
  const stride = Math.max(1, Math.floor(sampleStride));

  const points = [];
  const pushPoint = (ph, uu, vv) => {
    const rr = uu > 1e-15 ? 1 / uu : Infinity;
    points.push({
      phi: ph,
      r: rr,
      u: uu,
      du: vv,
      x: Number.isFinite(rr) ? rr * Math.cos(ph) : Infinity,
      y: Number.isFinite(rr) ? rr * Math.sin(ph) : Infinity,
    });
  };
  pushPoint(phi, u, v);

  let status = 'maxPhi';
  let rMin = u > 0 ? 1 / u : Infinity;

  for (let step = 1; step <= maxSteps && phi - phi0 < maxPhi; step++) {
    const h = Math.min(dphi, phi0 + maxPhi - phi);
    const [un, vn] = rk4StepU(u, v, h, 0);

    // En yakın geçiş noktası (u yerel maksimum, v: + -> -)
    if (v > 0 && vn <= 0) {
      const hit = bisectCrossingU(u, v, h, 0, 0, 'v');
      if (hit.u > 0 && 1 / hit.u < rMin) rMin = 1 / hit.u;
    }

    // Olay ufkuna yakalanma (r <= 2M)
    if (un >= 0.5) {
      const hit = bisectCrossingU(u, v, h, 0, 0.5, 'u');
      phi += hit.dh;
      u = hit.u;
      v = hit.v;
      rMin = 2;
      pushPoint(phi, u, v);
      status = 'captured';
      break;
    }

    // Kaçış (u <= uEscape ve dışa giderken)
    if (vn < 0 && un <= uEscape) {
      const hit = bisectCrossingU(u, v, h, 0, uEscape, 'u');
      phi += hit.dh;
      u = hit.u;
      v = hit.v;
      pushPoint(phi, u, v);
      status = 'escaped';
      break;
    }

    phi += h;
    u = un;
    v = vn;
    if (u > 0 && 1 / u < rMin) rMin = 1 / u;

    if (step % stride === 0 || phi - phi0 >= maxPhi - 1e-12) {
      pushPoint(phi, u, v);
    }
  }

  const captured = status === 'captured';
  let deflection = NaN;
  if (captured) {
    deflection = Infinity;
  } else if (status === 'escaped' && uStart === 0) {
    deflection = (phi - phi0) - Math.PI;
  }

  return {
    points,
    status,
    b,
    bCrit: B_CRIT_GEOM,
    captured,
    rMin,
    deflection,
    phiFinal: phi,
  };
}

/** Zayıf alan ışık sapma açısı Δφ = 4/b (geometrik birimler, M = 1): (b [M]) -> [rad]. */
export function lightDeflectionWeakField(b) {
  return 4 / Math.abs(b);
}

/** SI birimlerinde zayıf alan ışık sapma açısı Δφ = 4GM/(c²b): (massKg [kg], impactParamM [m]) -> [rad]. */
export function lightDeflectionSI(massKg, impactParamM) {
  return (4 * G * massKg) / (C2 * Math.abs(impactParamM));
}

/** Çarpışma parametresi b için tam GR ışık sapma açısını RK4 ile hesaplar (|b| ≤ 3√3 ise yakalanır -> Infinity): (b [M], opts?) -> [rad]. */
export function lightDeflectionAngle(b, { dphi = 0.002, maxPhi = 24 * Math.PI } = {}) {
  const absB = Math.abs(b);
  if (!(absB > B_CRIT_GEOM)) return Infinity;
  const res = integrateNullGeodesic({ b: absB, r0: Infinity, dphi, maxPhi, sampleStride: 1000 });
  return res.deflection;
}

/** Zayıf alan enberi (periapsis) presesyonu Δφ = 6π / [a(1 - e²)] (geometrik birimler, M = 1): (aGeom [M], e [0..1)) -> [rad/tur]. */
export function periapsisPrecessionWeakField(aGeom, e) {
  return (6 * Math.PI) / (aGeom * (1 - e * e));
}

/** SI birimlerinde zayıf alan enberi presesyonu Δφ = 6πGM / [c² a(1 - e²)]: (massKg [kg], aMeters [m], e [0..1)) -> [rad/tur]. */
export function periapsisPrecessionSI(massKg, aMeters, e) {
  return (6 * Math.PI * G * massKg) / (C2 * aMeters * (1 - e * e));
}

/** Yarı-latus rektum p ve dışmerkezlik e için bir tam yörüngedeki enberi presesyonunu RK4 ile sayısal hesaplar (M = 1): (p [M], e [0..1), opts?) -> { precession [rad], phiPeriod [rad], weakField [rad], L, E, rPeri, rApo }. */
export function periapsisPrecessionNumeric(p, e, { dphi = 0.002, maxPhi = 20 * Math.PI } = {}) {
  const bp = boundOrbitParams(p, e);
  const weakField = (6 * Math.PI) / p;
  if (!bp.valid) {
    return { precession: NaN, phiPeriod: NaN, weakField, L: bp.L, E: bp.E, rPeri: bp.rPeri, rApo: bp.rApo };
  }
  if (e === 0) {
    const phiPeriod = (2 * Math.PI) / Math.sqrt(1 - 6 / p);
    return { precession: phiPeriod - 2 * Math.PI, phiPeriod, weakField, L: bp.L, E: bp.E, rPeri: p, rApo: p };
  }
  const invL2 = 1 / (bp.L * bp.L);
  let u = (1 + e) / p;
  let v = 0;
  let phi = 0;
  let passedApo = false;

  while (phi < maxPhi) {
    const [un, vn] = rk4StepU(u, v, dphi, invL2);
    if (!passedApo && v <= 0 && vn > 0 && phi > 0.1) {
      passedApo = true;
    } else if (passedApo && v > 0 && vn <= 0) {
      const hit = bisectCrossingU(u, v, dphi, invL2, 0, 'v');
      const phiPeriod = phi + hit.dh;
      return {
        precession: phiPeriod - 2 * Math.PI,
        phiPeriod,
        weakField,
        L: bp.L,
        E: bp.E,
        rPeri: bp.rPeri,
        rApo: bp.rApo,
      };
    }
    phi += dphi;
    u = un;
    v = vn;
  }
  return { precession: NaN, phiPeriod: NaN, weakField, L: bp.L, E: bp.E, rPeri: bp.rPeri, rApo: bp.rApo };
}

// =====================================================================
// 5. KERR (DÖNEN) KARA DELİĞİ (a* = a/M ∈ [-1, 1])
// =====================================================================

function resolveEffectiveSpin(aStar, prograde) {
  const a = clamp(aStar, -1, 1);
  if (prograde === undefined) return a;
  return prograde ? Math.abs(a) : -Math.abs(a);
}

/** Kerr dış (r_+) ve iç (r_-) olay ufku yarıçapları (geometrik birimler, M = 1): (aStar [-1..1]) -> { rPlus [M], rMinus [M] }. */
export function kerrHorizonsGeom(aStar) {
  const a = Math.abs(aStar);
  if (a > 1) return { rPlus: NaN, rMinus: NaN };
  const s = Math.sqrt(Math.max(0, 1 - a * a));
  return { rPlus: 1 + s, rMinus: 1 - s };
}

/** Kerr dış ve iç ufuk yarıçapları (SI): (massKg [kg], aStar [-1..1]) -> { rPlus [m], rMinus [m] }. */
export function kerrHorizons(massKg, aStar) {
  const rg = gravRadius(massKg);
  const { rPlus, rMinus } = kerrHorizonsGeom(aStar);
  return { rPlus: rPlus * rg, rMinus: rMinus * rg };
}

/** Kerr ergosfer dış sınırı r_ergo(θ) = 1 + √(1 - a*² cos²θ) (geometrik birimler, M = 1, ekvatorda 2M): (aStar [-1..1], theta=π/2 [rad]) -> [M]. */
export function kerrErgosphereGeom(aStar, theta = Math.PI / 2) {
  if (Math.abs(aStar) > 1) return NaN;
  const c = Math.cos(theta);
  return 1 + Math.sqrt(Math.max(0, 1 - aStar * aStar * c * c));
}

/** Kerr ergosfer yarıçapı (SI): (massKg [kg], aStar [-1..1], theta=π/2 [rad]) -> [m]. */
export function kerrErgosphereRadius(massKg, aStar, theta = Math.PI / 2) {
  return kerrErgosphereGeom(aStar, theta) * gravRadius(massKg);
}

/** Bardeen-Press-Teukolsky formülüyle Kerr ISCO yarıçapı (M = 1; prograde belirtilmezse aStar >= 0 eşyönlü, aStar < 0 ters yönlü): (aStar [-1..1], prograde? [bool]) -> [M]. */
export function kerrIscoGeom(aStar, prograde = undefined) {
  if (Math.abs(aStar) > 1) return NaN;
  const aEff = resolveEffectiveSpin(aStar, prograde);
  const a = Math.abs(aEff);
  const Z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const Z2 = Math.sqrt(3 * a * a + Z1 * Z1);
  const term = Math.sqrt(Math.max(0, (3 - Z1) * (3 + Z1 + 2 * Z2)));
  return aEff >= 0 ? 3 + Z2 - term : 3 + Z2 + term;
}

/** Kerr ISCO yarıçapı (SI): (massKg [kg], aStar [-1..1], prograde? [bool]) -> [m]. */
export function kerrIsco(massKg, aStar, prograde = undefined) {
  return kerrIscoGeom(aStar, prograde) * gravRadius(massKg);
}

/** Kerr ekvatoryal dairesel foton yörüngesi yarıçapı 2{1 + cos[(2/3) arccos(∓a*)]} (M = 1): (aStar [-1..1], prograde? [bool]) -> [M]. */
export function kerrPhotonOrbitGeom(aStar, prograde = undefined) {
  if (Math.abs(aStar) > 1) return NaN;
  const aEff = resolveEffectiveSpin(aStar, prograde);
  return 2 * (1 + Math.cos((2 / 3) * Math.acos(clamp(-aEff, -1, 1))));
}

/** Kerr ekvatoryal dairesel foton yörüngesi yarıçapı (SI): (massKg [kg], aStar [-1..1], prograde? [bool]) -> [m]. */
export function kerrPhotonOrbit(massKg, aStar, prograde = undefined) {
  return kerrPhotonOrbitGeom(aStar, prograde) * gravRadius(massKg);
}

/** Kerr ekvatoryal dairesel yörünge enerji E, açısal momentum L ve açısal hızı Ω (M = 1): (r [M], aStar [-1..1], prograde? [bool]) -> { E, L, omega }. */
export function kerrCircularOrbitGeom(r, aStar, prograde = undefined) {
  if (Math.abs(aStar) > 1 || !(r > 0)) return { E: NaN, L: NaN, omega: NaN };
  const aEff = resolveEffectiveSpin(aStar, prograde);
  const rPh = kerrPhotonOrbitGeom(aEff);
  if (!(r > rPh)) {
    if (Math.abs(aEff - 1) < 1e-12 && Math.abs(r - 1) < 1e-12) {
      return { E: 1 / SQRT3, L: 2 / SQRT3, omega: 0.5 };
    }
    return { E: NaN, L: NaN, omega: NaN };
  }
  const sr = Math.sqrt(r);
  const r32 = r * sr;
  const denom = Math.sqrt(r32 - 3 * sr + 2 * aEff);
  const r34 = Math.pow(r, 0.75);
  const E = (r32 - 2 * sr + aEff) / (r34 * denom);
  const L = ((r * r - 2 * aEff * sr + aEff * aEff) / (r34 * denom)) * (aEff >= 0 ? 1 : -1);
  const omega = (aEff >= 0 ? 1 : -1) / (r32 + aEff);
  return { E, L, omega };
}

/** Kerr olay ufku açısal hızı Ω_H = a* / (2 r_+) (geometrik birimler, 1/M): (aStar [-1..1]) -> [M⁻¹]. */
export function kerrHorizonOmegaGeom(aStar) {
  const { rPlus } = kerrHorizonsGeom(aStar);
  if (!Number.isFinite(rPlus)) return NaN;
  return aStar / (2 * rPlus);
}

/** Kerr olay ufku açısal hızı Ω_H (SI): (massKg [kg], aStar [-1..1]) -> [rad s⁻¹]. */
export function kerrHorizonOmega(massKg, aStar) {
  return kerrHorizonOmegaGeom(aStar) / gravTime(massKg);
}

/** Kerr çerçeve sürüklenmesi (Lense-Thirring) açısal hızı ω(r, θ) = -g_tφ/g_φφ (M = 1): (r [M], aStar [-1..1], theta=π/2 [rad]) -> [M⁻¹]. */
export function kerrFrameDraggingGeom(r, aStar, theta = Math.PI / 2) {
  if (Math.abs(aStar) > 1 || !(r > 0)) return NaN;
  const a2 = aStar * aStar;
  const r2 = r * r;
  const delta = r2 - 2 * r + a2;
  const s = Math.sin(theta);
  const denom = (r2 + a2) * (r2 + a2) - a2 * delta * s * s;
  return (2 * aStar * r) / denom;
}

/** İnce yığılma diski ışınım verimi η = 1 - E_ISCO (E_ISCO = √(1 - 2/(3 r_ISCO))): (aStar [-1..1], prograde? [bool]) -> boyutsuz verim [0..0,4226]. */
export function kerrRadiativeEfficiency(aStar, prograde = undefined) {
  const rIsco = kerrIscoGeom(aStar, prograde);
  if (!Number.isFinite(rIsco)) return NaN;
  const Eisco = Math.sqrt(Math.max(0, 1 - 2 / (3 * rIsco)));
  return 1 - Eisco;
}

/** Christodoulou-Ruffini indirgenemez kütle M_irr ve çıkarılabilir dönme enerjisi: (massKg [kg], aStar [-1..1]) -> { irreducibleMassKg [kg], extractableMassKg [kg], extractableEnergyJ [J], extractableFraction }. */
export function kerrIrreducibleMass(massKg, aStar) {
  const { rPlus } = kerrHorizonsGeom(aStar);
  if (!Number.isFinite(rPlus)) {
    return { irreducibleMassKg: NaN, extractableMassKg: NaN, extractableEnergyJ: NaN, extractableFraction: NaN };
  }
  const fracIrr = Math.sqrt(rPlus / 2);
  const irreducibleMassKg = massKg * fracIrr;
  const extractableMassKg = massKg - irreducibleMassKg;
  return {
    irreducibleMassKg,
    extractableMassKg,
    extractableEnergyJ: extractableMassKg * C2,
    extractableFraction: 1 - fracIrr,
  };
}

/** Verilen kütle ve spin için tüm temel Kerr kara delik büyüklüklerinin özeti: (massKg [kg], aStar [-1..1]) -> object. */
export function kerrSummary(massKg, aStar) {
  const rg = gravRadius(massKg);
  const { rPlus, rMinus } = kerrHorizonsGeom(aStar);
  const rIscoPro = kerrIscoGeom(aStar, true);
  const rIscoRetro = kerrIscoGeom(aStar, false);
  const rPhPro = kerrPhotonOrbitGeom(aStar, true);
  const rPhRetro = kerrPhotonOrbitGeom(aStar, false);
  const irr = kerrIrreducibleMass(massKg, aStar);
  return {
    massKg,
    aStar,
    rPlusGeom: rPlus,
    rMinusGeom: rMinus,
    rPlus: rPlus * rg,
    rMinus: rMinus * rg,
    ergosphereEqGeom: 2,
    ergosphereEq: 2 * rg,
    iscoProgradeGeom: rIscoPro,
    iscoRetrogradeGeom: rIscoRetro,
    iscoPrograde: rIscoPro * rg,
    iscoRetrograde: rIscoRetro * rg,
    photonProgradeGeom: rPhPro,
    photonRetrogradeGeom: rPhRetro,
    photonPrograde: rPhPro * rg,
    photonRetrograde: rPhRetro * rg,
    horizonOmegaGeom: kerrHorizonOmegaGeom(aStar),
    horizonOmega: kerrHorizonOmega(massKg, aStar),
    efficiencyPrograde: kerrRadiativeEfficiency(aStar, true),
    efficiencyRetrograde: kerrRadiativeEfficiency(aStar, false),
    ...irr,
  };
}

// =====================================================================
// 6. GELGİT KUVVETİ VE SPAGETTİLEŞME
// =====================================================================

/** L uzunluğundaki cisim boyunca r uzaklığındaki radyal gelgit ivmesi Δa = 2GML/r³: (massKg [kg], rMeters [m], bodyLengthM=2 [m]) -> [m s⁻²]. */
export function tidalAcceleration(massKg, rMeters, bodyLengthM = 2) {
  if (!(rMeters > 0)) return NaN;
  return (2 * G * massKg * bodyLengthM) / (rMeters * rMeters * rMeters);
}

/** Gelgit ivmesinin maxAccelMs2 sınırına ulaştığı yarıçap r = (2GML/a_max)^(1/3): (massKg [kg], maxAccelMs2=10*G0 [m s⁻²], bodyLengthM=2 [m]) -> [m]. */
export function tidalRadius(massKg, maxAccelMs2 = 10 * G0, bodyLengthM = 2) {
  if (!(massKg > 0) || !(maxAccelMs2 > 0) || !(bodyLengthM > 0)) return NaN;
  return Math.cbrt((2 * G * massKg * bodyLengthM) / maxAccelMs2);
}

/** Cismin olay ufkunu verilen gelgit sınırını aşmadan geçebilmesi için gereken en küçük kara delik kütlesi M_crit = (c³/(2G))√(L/a_max): (maxAccelMs2=10*G0 [m s⁻²], bodyLengthM=2 [m]) -> [kg]. */
export function spaghettificationMassThreshold(maxAccelMs2 = 10 * G0, bodyLengthM = 2) {
  if (!(maxAccelMs2 > 0) || !(bodyLengthM > 0)) return NaN;
  return (C3 / (2 * G)) * Math.sqrt(bodyLengthM / maxAccelMs2);
}

/** Verilen kara delik kütlesi için spagettileşme analizini (ufuk içi/dışı, yarıçap, eşik kütle) döndürür: (massKg [kg], opts?: { bodyLengthM=2, limitG=10 }) -> object. */
export function spaghettificationAnalysis(massKg, { bodyLengthM = 2, limitG = 10 } = {}) {
  const rs = schwarzschildRadius(massKg);
  const maxAccelMs2 = limitG * G0;
  const rTidal = tidalRadius(massKg, maxAccelMs2, bodyLengthM);
  const horizonTidalMs2 = tidalAcceleration(massKg, rs, bodyLengthM);
  const thresholdMassKg = spaghettificationMassThreshold(maxAccelMs2, bodyLengthM);
  return {
    schwarzschildRadius: rs,
    tidalRadius: rTidal,
    ratioToHorizon: rTidal / rs,
    horizonTidalMs2,
    horizonTidalG: horizonTidalMs2 / G0,
    outsideHorizon: rTidal > rs,
    survivesHorizon: rTidal <= rs,
    thresholdMassKg,
    thresholdMassSolar: kgToSolarMass(thresholdMassKg),
  };
}

// =====================================================================
// 7. HAWKING IŞIMASI VE KARA DELİK TERMODİNAMİĞİ
// =====================================================================

/** Hawking sıcaklığı T_H = ħc³ / (8πGMk_B): (massKg [kg]) -> [K]. */
export function hawkingTemperature(massKg) {
  return (HBAR * C3) / (8 * Math.PI * G * massKg * K_B);
}

/** Bekenstein-Hawking entropisi S = 4πGM²k_B / (ħc): (massKg [kg]) -> [J K⁻¹]. */
export function bekensteinHawkingEntropy(massKg) {
  return (4 * Math.PI * G * massKg * massKg * K_B) / (HBAR * C);
}

/** Boyutsuz Bekenstein-Hawking entropisi S/k_B = 4πGM² / (ħc): (massKg [kg]) -> boyutsuz sayı. */
export function bekensteinHawkingEntropyDimensionless(massKg) {
  return (4 * Math.PI * G * massKg * massKg) / (HBAR * C);
}

/** Kara cisim yaklaşımında Hawking ışıma gücü P = ħc⁶ / (15360 π G² M²): (massKg [kg]) -> [W]. */
export function hawkingLuminosity(massKg) {
  return (HBAR * C6) / (15360 * Math.PI * G * G * massKg * massKg);
}

/** Kara deliğin Hawking buharlaşma süresi t_evap = 5120 π G² M³ / (ħc⁴): (massKg [kg]) -> [s]. */
export function hawkingEvaporationTime(massKg) {
  return (5120 * Math.PI * G * G * massKg * massKg * massKg) / (HBAR * C4);
}

/** Verilen sürede tamamen buharlaşan kara deliğin başlangıç kütlesi M = (ħc⁴ t / (5120 π G²))^(1/3): (timeSeconds=AGE_OF_UNIVERSE [s]) -> [kg]. */
export function evaporationMassForTime(timeSeconds = AGE_OF_UNIVERSE) {
  return Math.cbrt((HBAR * C4 * timeSeconds) / (5120 * Math.PI * G * G));
}

/** Wien yer değiştirme yasasıyla kara cisim tepe dalga boyu λ_peak = b / T: (tempK [K]) -> [m]. */
export function wienPeakWavelength(tempK) {
  if (!(tempK > 0)) return NaN;
  return WIEN_B / tempK;
}

/** Hawking ışımasının Wien tepe dalga boyu (≈ 15,90 r_s): (massKg [kg]) -> [m]. */
export function hawkingPeakWavelength(massKg) {
  return wienPeakWavelength(hawkingTemperature(massKg));
}

/** Kara delik termodinamiği ve Hawking ışımasının tüm büyüklüklerini özetler: (massKg [kg]) -> object. */
export function hawkingSummary(massKg) {
  const temperature = hawkingTemperature(massKg);
  const entropy = bekensteinHawkingEntropy(massKg);
  const entropyDimensionless = bekensteinHawkingEntropyDimensionless(massKg);
  const luminosity = hawkingLuminosity(massKg);
  const evaporationSeconds = hawkingEvaporationTime(massKg);
  const peakWavelength = wienPeakWavelength(temperature);
  return {
    massKg,
    temperature,
    entropy,
    entropyDimensionless,
    luminosity,
    evaporationSeconds,
    evaporationYears: secToYears(evaporationSeconds),
    peakWavelength,
  };
}

// =====================================================================
// 8. YIĞILMA DİSKİ VE KARA CİSİM RENGİ
// =====================================================================

/** Eddington parlaklığı L_Edd = 4πGMm_p c / σ_T (≈ 1,26 × 10³¹ W / M☉): (massKg [kg]) -> [W]. */
export function eddingtonLuminosity(massKg) {
  return (4 * Math.PI * G * massKg * M_PROTON * C) / SIGMA_T;
}

/** Verilen ışınım verimi η için Eddington kütle yığılma hızı Ṁ_Edd = L_Edd / (η c²): (massKg [kg], efficiency=0.1) -> [kg s⁻¹]. */
export function eddingtonAccretionRate(massKg, efficiency = 0.1) {
  if (!(efficiency > 0)) return NaN;
  return eddingtonLuminosity(massKg) / (efficiency * C2);
}

/** Dalga boyuna göre elektromanyetik tayf bölgesini Türkçe döndürür: (wavelengthM [m]) -> string. */
export function classifySpectralBand(wavelengthM) {
  if (!(wavelengthM > 0)) return '—';
  if (wavelengthM < 1e-11) return 'Gama ışını';
  if (wavelengthM < 1e-8) return 'X-ışını';
  if (wavelengthM < 3.8e-7) return 'Morötesi (UV)';
  if (wavelengthM <= 7.5e-7) return 'Görünür ışık';
  if (wavelengthM < 1e-3) return 'Kızılötesi';
  return 'Radyo / Mikrodalga';
}

/** Shakura-Sunyaev ince yığılma diski sıcaklık profili T(r) = [(3GMṀ / (8πσ_SB r³))(1 - √(r_in/r))]^(1/4): (massKg [kg], mdotKgPerS [kg s⁻¹], rMeters [m], rInMeters?=r_ISCO [m]) -> [K]. */
export function diskTemperature(massKg, mdotKgPerS, rMeters, rInMeters = schwarzschildIsco(massKg)) {
  if (!(rMeters > rInMeters) || !(massKg > 0) || !(mdotKgPerS > 0)) return 0;
  const term = ((3 * G * massKg * mdotKgPerS) / (8 * Math.PI * SIGMA_SB * rMeters * rMeters * rMeters))
    * (1 - Math.sqrt(rInMeters / rMeters));
  return term > 0 ? Math.pow(term, 0.25) : 0;
}

/** Shakura-Sunyaev ince diskinde azami sıcaklık (r_peak = 49/36 r_in), tepe dalga boyu ve tayf bölgesi: (massKg [kg], mdotKgPerS [kg s⁻¹], rInMeters?=r_ISCO [m]) -> { Tmax [K], rPeak [m], peakWavelengthM [m], peakEnergyEv [eV], band }. */
export function diskTemperatureMax(massKg, mdotKgPerS, rInMeters = schwarzschildIsco(massKg)) {
  const rPeak = (49 / 36) * rInMeters;
  const Tmax = diskTemperature(massKg, mdotKgPerS, rPeak, rInMeters);
  const peakWavelengthM = Tmax > 0 ? wienPeakWavelength(Tmax) : NaN;
  const peakEnergyEv = peakWavelengthM > 0 ? (H_PLANCK * C) / (peakWavelengthM * 1.602176634e-19) : NaN;
  return {
    Tmax,
    rPeak,
    peakWavelengthM,
    peakEnergyEv,
    band: classifySpectralBand(peakWavelengthM),
  };
}

/** İnce disk sıcaklık profilini r_in'den r_out'a logaritmik örnekleme ile üretir: (massKg [kg], mdotKgPerS [kg s⁻¹], opts?: { rInMeters, rOutMeters, samples=80 }) -> Array<{ r, rOverRg, T, rgb }>. */
export function diskTemperatureProfile(massKg, mdotKgPerS, { rInMeters = schwarzschildIsco(massKg), rOutMeters = null, samples = 80 } = {}) {
  const rg = gravRadius(massKg);
  const rOut = rOutMeters ?? 50 * rInMeters;
  const out = [];
  const logMin = Math.log(rInMeters);
  const logMax = Math.log(rOut);
  for (let i = 0; i <= samples; i++) {
    const r = Math.exp(logMin + ((logMax - logMin) * i) / samples);
    const T = diskTemperature(massKg, mdotKgPerS, r, rInMeters);
    out.push({ r, rOverRg: r / rg, T, rgb: blackbodyToRGB(T) });
  }
  return out;
}

/** Sıcaklıktan (≈ 1000 K – 40000 K aralığında normalize) [0..1] bileşenli kara cisim RGB rengini hesaplar: (tempK [K]) -> { r, g, b }. */
export function blackbodyToRGB(tempK) {
  if (!(tempK > 0) || !Number.isFinite(tempK)) return { r: 0, g: 0, b: 0 };
  const T = clamp(tempK, 1000, 40000);
  const t = T / 100;
  let r, g, b;
  if (t <= 66) {
    r = 1;
    g = clamp((99.4708025861 * Math.log(t) - 161.1195681661) / 255, 0, 1);
    b = t <= 19 ? 0 : clamp((138.5177312231 * Math.log(t - 10) - 305.0447927307) / 255, 0, 1);
  } else {
    r = clamp((329.698727446 * Math.pow(t - 60, -0.1332047592)) / 255, 0, 1);
    g = clamp((288.1221695283 * Math.pow(t - 60, -0.0755148492)) / 255, 0, 1);
    b = 1;
  }
  if (tempK < 1000) {
    const fade = clamp(tempK / 1000, 0, 1);
    const scale = fade * fade;
    return { r: r * scale, g: g * scale, b: b * scale };
  }
  return { r, g, b };
}

// =====================================================================
// 9. İKİLİ SİSTEMLERDEN KÜTLEÇEKİM DALGALARI
// =====================================================================

/** İkili sistemin cıvıltı kütlesi (chirp mass) M_c = (m1 m2)^(3/5) / (m1 + m2)^(1/5): (m1Kg [kg], m2Kg [kg]) -> [kg]. */
export function chirpMass(m1Kg, m2Kg) {
  if (!(m1Kg > 0) || !(m2Kg > 0)) return NaN;
  return Math.pow(m1Kg * m2Kg, 0.6) / Math.pow(m1Kg + m2Kg, 0.2);
}

/** Toplam kütle M'nin ISCO yörüngesindeki kütleçekim dalgası frekansı f_ISCO = c³ / (6^(3/2) π G M): (totalMassKg [kg]) -> [Hz]. */
export function gwIscoFrequency(totalMassKg) {
  return C3 / (Math.pow(6, 1.5) * Math.PI * G * totalMassKg);
}

/** Birleşmeye kalan τ süresi için Newton dörtkutuplu içe sarmal (inspiral) GW frekansı f(τ): (chirpMassKg [kg], tauSeconds [s]) -> [Hz]. */
export function gwInspiralFrequency(chirpMassKg, tauSeconds) {
  if (!(chirpMassKg > 0) || !(tauSeconds > 0)) return NaN;
  const tc = (G * chirpMassKg) / C3;
  return (1 / Math.PI) * Math.pow(5 / (256 * tauSeconds), 3 / 8) * Math.pow(tc, -5 / 8);
}

/** Verilen f frekansından birleşmeye kadar kalan süre τ(f): (chirpMassKg [kg], freqHz [Hz]) -> [s]. */
export function gwTimeToMerger(chirpMassKg, freqHz) {
  if (!(chirpMassKg > 0) || !(freqHz > 0)) return NaN;
  const tc = (G * chirpMassKg) / C3;
  return (5 / 256) * Math.pow(tc, -5 / 3) * Math.pow(Math.PI * freqHz, -8 / 3);
}

/** D uzaklığında f frekansındaki yüz yüze (face-on) kütleçekim dalgası gerinim genliği h(f, D): (chirpMassKg [kg], freqHz [Hz], distanceM [m]) -> boyutsuz gerinim h. */
export function gwStrainAmplitude(chirpMassKg, freqHz, distanceM) {
  if (!(chirpMassKg > 0) || !(freqHz > 0) || !(distanceM > 0)) return NaN;
  const tc = (G * chirpMassKg) / C3;
  return ((4 * C) / distanceM) * Math.pow(tc, 5 / 3) * Math.pow(Math.PI * freqHz, 2 / 3);
}

/** Dönen olmayan ikili birleşmede kütleçekim dalgalarıyla yayılan toplam enerji kesri ΔE / (M c²) (eşit kütlede ≈ %4,84): (m1Kg [kg], m2Kg [kg]) -> boyutsuz kesir. */
export function gwRadiatedEnergyFraction(m1Kg, m2Kg) {
  if (!(m1Kg > 0) || !(m2Kg > 0)) return NaN;
  const M = m1Kg + m2Kg;
  const nu = (m1Kg * m2Kg) / (M * M);
  const etaTest = 1 - Math.sqrt(8 / 9); // 0.057191
  return etaTest * nu + 0.546 * nu * nu;
}

/** Birleşme sonrası kalıntı kara deliğin kütlesini, spinini ve yayılan enerjiyi (sayısal görelilik uyumu) hesaplar: (m1Kg [kg], m2Kg [kg]) -> { totalMassKg, finalMassKg, radiatedMassKg, radiatedFraction, radiatedEnergyJ, finalSpin, symMassRatio }. */
export function gwRemnantProperties(m1Kg, m2Kg) {
  const totalMassKg = m1Kg + m2Kg;
  const nu = (m1Kg * m2Kg) / (totalMassKg * totalMassKg);
  const radiatedFraction = gwRadiatedEnergyFraction(m1Kg, m2Kg);
  const radiatedMassKg = totalMassKg * radiatedFraction;
  const finalMassKg = totalMassKg - radiatedMassKg;
  // Buonanno-Kidder-Lehner / Rezzolla NR fit (dönen olmayan ikililer için): ν=0.25 -> a_f ≈ 0.687
  const finalSpin = clamp(2 * SQRT3 * nu - 3.871 * nu * nu + 4.028 * nu * nu * nu, 0, 0.998);
  return {
    totalMassKg,
    finalMassKg,
    radiatedMassKg,
    radiatedFraction,
    radiatedEnergyJ: radiatedMassKg * C2,
    finalSpin,
    symMassRatio: nu,
  };
}

/** Kalıntı kara deliğin temel (l=2, m=2, n=0) yarı-normal mod (QNM) çınlama frekansı (Echeverria uyumu: Mω = 1 - 0,63(1 - a_f)^0,3; a_f=0, 1 M☉ için ≈ 1,2×10⁴ Hz): (finalMassKg [kg], finalSpin [0..0,998]) -> [Hz]. */
export function gwQnmFrequency(finalMassKg, finalSpin) {
  if (!(finalMassKg > 0)) return NaN;
  const af = clamp(Math.abs(finalSpin), 0, 0.9999);
  const dimlessOmega = 1 - 0.63 * Math.pow(1 - af, 0.3);
  return (dimlessOmega * C3) / (2 * Math.PI * G * finalMassKg);
}

/** Temel QNM çınlamasının sönümleme süresi τ_QNM = Q / (π f_QNM), Q ≈ 2(1 - a_f)^(-0,45): (finalMassKg [kg], finalSpin [0..0,998]) -> [s]. */
export function gwQnmDampingTime(finalMassKg, finalSpin) {
  const f = gwQnmFrequency(finalMassKg, finalSpin);
  const af = clamp(Math.abs(finalSpin), 0, 0.9999);
  const Q = 2 * Math.pow(1 - af, -0.45);
  return Q / (Math.PI * f);
}

/** Çizim ve ses sentezine uygun örneklenmiş cıvıltı + çınlama (inspiral -> ISCO -> QNM ringdown) dalga biçimi üretir: (m1Kg [kg], m2Kg [kg], distanceM [m], opts?: { fStart?, duration?, samples=1024, ringdownFactor=6 }) -> { t, h, f, amp, phase, tIsco, fIsco, fQnm, tauQnm, chirpMassKg, totalMassKg, finalMassKg, finalSpin, radiatedFraction, radiatedEnergyJ, peakStrain }. */
export function generateChirpWaveform(m1Kg, m2Kg, distanceM, {
  fStart = null,
  duration = null,
  samples = 1024,
  ringdownFactor = 6,
} = {}) {
  const Mc = chirpMass(m1Kg, m2Kg);
  const rem = gwRemnantProperties(m1Kg, m2Kg);
  const fIsco = gwIscoFrequency(rem.totalMassKg);
  const fQnm = gwQnmFrequency(rem.finalMassKg, rem.finalSpin);
  const tauQnm = gwQnmDampingTime(rem.finalMassKg, rem.finalSpin);
  const tauIsco = gwTimeToMerger(Mc, fIsco);
  const ampIsco = gwStrainAmplitude(Mc, fIsco, distanceM);
  const tc = (G * Mc) / C3;

  let tInspiral;
  if (duration !== null && duration > 0) {
    tInspiral = duration;
  } else {
    const f0 = fStart && fStart > 0 && fStart < fIsco ? fStart : Math.max(10, fIsco * 0.25);
    tInspiral = Math.max(tauIsco * 2, gwTimeToMerger(Mc, f0) - tauIsco);
  }
  const tRing = ringdownFactor * tauQnm;
  const tStart = -tInspiral;
  const tEnd = tRing;
  const N = Math.max(16, Math.floor(samples));
  const phiAtIsco = -2 * Math.pow(tauIsco / (5 * tc), 5 / 8);

  const t = new Float64Array(N);
  const h = new Float64Array(N);
  const f = new Float64Array(N);
  const amp = new Float64Array(N);
  const phase = new Float64Array(N);
  let peakStrain = 0;

  for (let i = 0; i < N; i++) {
    const ti = tStart + ((tEnd - tStart) * i) / (N - 1);
    t[i] = ti;
    if (ti <= 0) {
      const tau = tauIsco - ti;
      const fi = gwInspiralFrequency(Mc, tau);
      const ai = gwStrainAmplitude(Mc, fi, distanceM);
      const ph = -2 * Math.pow(tau / (5 * tc), 5 / 8) - phiAtIsco;
      f[i] = fi;
      amp[i] = ai;
      phase[i] = ph;
      h[i] = ai * Math.cos(ph);
    } else {
      const ai = ampIsco * Math.exp(-ti / tauQnm);
      const ph = 2 * Math.PI * fQnm * ti;
      f[i] = fQnm;
      amp[i] = ai;
      phase[i] = ph;
      h[i] = ai * Math.cos(ph);
    }
    const ah = Math.abs(h[i]);
    if (ah > peakStrain) peakStrain = ah;
  }

  return {
    t,
    h,
    f,
    amp,
    phase,
    tIsco: 0,
    fIsco,
    fQnm,
    tauQnm,
    chirpMassKg: Mc,
    totalMassKg: rem.totalMassKg,
    finalMassKg: rem.finalMassKg,
    finalSpin: rem.finalSpin,
    radiatedFraction: rem.radiatedFraction,
    radiatedEnergyJ: rem.radiatedEnergyJ,
    peakStrain,
  };
}

/** Gerçek LIGO/Virgo kütleçekim dalgası birleşme önayarları (kütleler M☉, uzaklıklar Mpc). */
export const GW_PRESETS = Object.freeze([
  {
    // Abbott et al. 2016 (PRL 116, 061102): m1 = 36 M☉, m2 = 29 M☉, D = 410 Mpc, Mc ≈ 28.1 M☉
    id: 'GW150914',
    name: 'GW150914',
    kind: 'BBH',
    kindLabel: 'İkili Kara Delik',
    m1Solar: 36,
    m2Solar: 29,
    distanceMpc: 410,
    fStart: 35,
    year: 2015,
    note: 'Doğrudan gözlemlenen ilk kütleçekim dalgası; iki kara delik birleşip ≈ 3 M☉ enerji yaydı.',
  },
  {
    // Abbott et al. 2017 (PRL 119, 161101): m1 ≈ 1.46 M☉, m2 ≈ 1.27 M☉, D = 40 Mpc, Mc ≈ 1.188 M☉ (detektör)
    id: 'GW170817',
    name: 'GW170817',
    kind: 'BNS',
    kindLabel: 'İkili Nötron Yıldızı',
    m1Solar: 1.46,
    m2Solar: 1.27,
    distanceMpc: 40,
    fStart: 200,
    year: 2017,
    note: 'Çoklu habercili astronomiyi başlatan ilk nötron yıldızı birleşmesi; gama patlaması ve kilonova eşlik etti.',
  },
  {
    // Abbott et al. 2020 (PRL 125, 101102): m1 = 85 M☉, m2 = 66 M☉, D = 5300 Mpc -> M_f = 142 M☉
    id: 'GW190521',
    name: 'GW190521',
    kind: 'BBH',
    kindLabel: 'Ağır İkili Kara Delik',
    m1Solar: 85,
    m2Solar: 66,
    distanceMpc: 5300,
    fStart: 20,
    year: 2019,
    note: '142 M☉ kalıntı üreterek orta kütleli kara deliklerin (IMBH) ilk doğrudan kanıtını sundu.',
  },
  {
    // Abbott et al. 2016 (PRL 116, 241103): m1 = 14.2 M☉, m2 = 7.5 M☉, D = 440 Mpc
    id: 'GW151226',
    name: 'GW151226',
    kind: 'BBH',
    kindLabel: 'İkili Kara Delik',
    m1Solar: 14.2,
    m2Solar: 7.5,
    distanceMpc: 440,
    fStart: 40,
    year: 2015,
    note: 'Daha düşük kütleli iki kara deliğin yaklaşık 1 saniye süren 55 döngülük uzun cıvıltı sinyali.',
  },
]);

// =====================================================================
// 10. GERÇEK KARA DELİKLER KATALOĞU
// =====================================================================

/** Gözlemlenmiş gerçek kara delikler kataloğu (kütle M☉, uzaklık pc, ölçülmüşse boyutsuz spin a*). */
export const BH_CATALOG = Object.freeze([
  {
    // GRAVITY Collaboration 2019 (A&A 625, L10) & 2021; EHT Collaboration 2022 (ApJL 930, L12): M ≈ 4.15×10⁶ M☉, D ≈ 8.28 kpc
    id: 'sgr-a',
    name: 'Sagittarius A* (Sgr A*)',
    type: 'supermassive',
    typeLabel: 'Süperkütleli',
    massSolar: 4.15e6,
    massErrSolar: 0.14e6,
    massText: '(4,15 ± 0,14) × 10⁶ M☉',
    distancePc: 8280,
    distanceText: '8,28 kpc (≈ 27 000 ly)',
    spin: null,
    spinText: 'Kesin ölçüm yok (EHT yüksek spin yönünde)',
    discoveryYear: 1974,
    constellation: 'Yay (Sagittarius)',
    note: 'Samanyolu galaksimizin merkezindeki süperkütleli kara delik. 2022\'de Olay Ufku Teleskobu (EHT) ile doğrudan görüntülendi.',
  },
  {
    // EHT Collaboration 2019 (ApJL 875, L1): M = (6.5 ± 0.7)×10⁹ M☉, D = 16.8 ± 0.8 Mpc; Sargent et al. 1978 dynamical evidence
    id: 'm87-star',
    name: 'M87* (Messier 87*)',
    type: 'supermassive',
    typeLabel: 'Süperkütleli',
    massSolar: 6.5e9,
    massErrSolar: 0.7e9,
    massText: '(6,5 ± 0,7) × 10⁹ M☉',
    distancePc: 16.8e6,
    distanceText: '16,8 Mpc (≈ 54,8 milyon ly)',
    spin: null,
    spinText: 'Kesin değil (jet gücü yüksek spin işaret eder)',
    discoveryYear: 1978,
    constellation: 'Başak (Virgo)',
    note: '2019\'da EHT tarafından gölgesi doğrudan görüntülenen ilk kara delik. Yaklaşık 5000 ışık yılı uzunluğunda göreli bir jet fırlatır.',
  },
  {
    // Miller-Jones et al. 2021 (Science 371, 1046): M = 21.2 ± 2.2 M☉, D = 2.22 kpc, a* > 0.9985; Bowyer et al. 1965 (1964 flight)
    id: 'cygnus-x1',
    name: 'Cygnus X-1',
    type: 'stellar',
    typeLabel: 'Yıldızsal',
    massSolar: 21.2,
    massErrSolar: 2.2,
    massText: '21,2 ± 2,2 M☉',
    distancePc: 2220,
    distanceText: '2,22 kpc (≈ 7240 ly)',
    spin: 0.998,
    spinText: 'a* > 0,99 (neredeyse azami)',
    discoveryYear: 1964,
    constellation: 'Kuğu (Cygnus)',
    note: 'Kara delik olduğu geniş kabul gören ilk gök cismi; mavi üstdev HDE 226868 ile yüksek kütleli bir X-ışını ikilisi oluşturur.',
  },
  {
    // Abbott et al. 2016 (PRL 116, 061102): M_f = 62 ± 4 M☉, D = 410 Mpc, a_f = 0.68 ± 0.05
    id: 'gw150914',
    name: 'GW150914 Kalıntısı',
    type: 'stellar',
    typeLabel: 'Yıldızsal (Birleşme)',
    massSolar: 62.0,
    massErrSolar: 4.0,
    massText: '62 ± 4 M☉',
    distancePc: 410e6,
    distanceText: '410 Mpc (≈ 1,3 milyar ly)',
    spin: 0.68,
    spinText: 'a* = 0,68 ± 0,05',
    discoveryYear: 2015,
    constellation: 'Güney gökküre',
    note: '36 M☉ ve 29 M☉\'lik iki kara deliğin birleşmesiyle doğdu; LIGO\'nun doğrudan saptadığı ilk kütleçekim dalgasının kaynağıdır.',
  },
  {
    // Khargharia et al. 2010 (ApJ 716, 1105): M = 9.0 ± 0.6 M☉; Miller-Jones et al. 2009: D = 2.39 kpc; Walton et al. 2017: a* > 0.92
    id: 'v404-cygni',
    name: 'V404 Cygni',
    type: 'stellar',
    typeLabel: 'Yıldızsal',
    massSolar: 9.0,
    massErrSolar: 0.6,
    massText: '9,0 ± 0,6 M☉',
    distancePc: 2390,
    distanceText: '2,39 kpc (≈ 7800 ly)',
    spin: 0.92,
    spinText: 'a* > 0,92',
    discoveryYear: 1989,
    constellation: 'Kuğu (Cygnus)',
    note: 'Radyo paralaksıyla uzaklığı hassas ölçülen ilk kara deliklerden; 2015\'te dev bir X-ışını ve optik patlama sergiledi.',
  },
  {
    // El-Badry et al. 2023 (MNRAS 518, 1057): M = 9.62 ± 0.18 M☉, D = 478 ± 5 pc (Gaia DR3)
    id: 'gaia-bh1',
    name: 'Gaia BH1',
    type: 'stellar',
    typeLabel: 'Yıldızsal (Uykuda)',
    massSolar: 9.62,
    massErrSolar: 0.18,
    massText: '9,62 ± 0,18 M☉',
    distancePc: 478,
    distanceText: '478 pc (≈ 1560 ly)',
    spin: null,
    spinText: 'Ölçülmedi (yığılma yok)',
    discoveryYear: 2022,
    constellation: 'Yılancı (Ophiuchus)',
    note: 'Dünya\'ya bilinen en yakın kara delik. Güneş benzeri bir yıldızın 185,6 günlük yörüngesindeki astrometrik salınımından keşfedildi.',
  },
  {
    // Ge et al. 2019 (MNRAS 488, 4338): M ≈ 4.07×10¹⁰ M☉ (Shemmer et al. 2004: 6.6×10¹⁰ M☉); z = 2.219 (light-travel ≈ 10.4 Gly ≈ 3.2 Gpc)
    id: 'ton-618',
    name: 'TON 618',
    type: 'supermassive',
    typeLabel: 'Aşırı Kütleli (Kuasar)',
    massSolar: 4.07e10,
    massErrSolar: 1.5e10,
    massText: '≈ 4,1 × 10¹⁰ M☉ (4–6,6 × 10¹⁰)',
    distancePc: 3.2e9,
    distanceText: 'z = 2,219 (≈ 10,4 milyar ışık yılı uzaklık)',
    spin: null,
    spinText: 'Ölçülmedi',
    discoveryYear: 1957,
    constellation: 'Av Köpekleri (Canes Venatici)',
    note: 'Bilinen en büyük kütleli kuasar kara deliklerinden biri; olay ufku yarıçapı Güneş Sistemi\'nin onlarca katıdır.',
  },
  {
    // Cantrell et al. 2010 (ApJ 710, 1127): M = 6.61 ± 0.25 M☉, D = 1.06 kpc; Gou et al. 2010 (ApJ 718, L122): a* = 0.12 ± 0.19
    id: 'a0620-00',
    name: 'A0620-00 (V616 Mon)',
    type: 'stellar',
    typeLabel: 'Yıldızsal',
    massSolar: 6.61,
    massErrSolar: 0.25,
    massText: '6,61 ± 0,25 M☉',
    distancePc: 1060,
    distanceText: '1,06 kpc (≈ 3460 ly)',
    spin: 0.12,
    spinText: 'a* = 0,12 ± 0,19 (yavaş dönen)',
    discoveryYear: 1975,
    constellation: 'Tekboynuz (Monoceros)',
    note: '1975\'te gökyüzündeki en parlak X-ışını kaynağı haline gelen X-ışını novası; görece yavaş dönen tipik bir yıldızsal kara delik.',
  },
  {
    // Reid et al. 2014 (ApJ 796, 2): M = 12.4 ± 2.0 M☉, D = 8.6 kpc; McClintock et al. 2006 / Miller et al. 2013: a* > 0.98
    id: 'grs-1915',
    name: 'GRS 1915+105',
    type: 'stellar',
    typeLabel: 'Yıldızsal (Mikrokuasar)',
    massSolar: 12.4,
    massErrSolar: 2.0,
    massText: '12,4 ± 2,0 M☉',
    distancePc: 8600,
    distanceText: '8,6 kpc (≈ 28 000 ly)',
    spin: 0.98,
    spinText: 'a* > 0,98',
    discoveryYear: 1992,
    constellation: 'Kartal (Aquila)',
    note: 'Samanyolu\'nda görünürde ışıktan hızlı (süperlüminal) radyo jetleri keşfedilen ilk mikrokuasar; neredeyse sınır hızında döner.',
  },
  {
    // Gaia Collaboration 2024 (A&A 686, L2): M = 32.70 ± 0.82 M☉, D = 590.6 ± 5.8 pc
    id: 'gaia-bh3',
    name: 'Gaia BH3',
    type: 'stellar',
    typeLabel: 'Yıldızsal (Uykuda)',
    massSolar: 32.7,
    massErrSolar: 0.82,
    massText: '32,7 ± 0,82 M☉',
    distancePc: 590.6,
    distanceText: '591 pc (≈ 1926 ly)',
    spin: null,
    spinText: 'Ölçülmedi (yığılma yok)',
    discoveryYear: 2024,
    constellation: 'Kartal (Aquila)',
    note: 'Samanyolu\'nda bilinen en ağır yıldızsal kökenli kara delik; metalce fakir yaşlı bir yıldızla 11,6 yıllık yörüngededir.',
  },
  {
    // Abbott et al. 2020 (PRL 125, 101102): M_f = 142 +28/-16 M☉, D = 5.3 Gpc, a_f = 0.72 +0.09/-0.12
    id: 'gw190521',
    name: 'GW190521 Kalıntısı',
    type: 'intermediate',
    typeLabel: 'Orta Kütleli (IMBH)',
    massSolar: 142,
    massErrSolar: 28,
    massText: '142 ± 28 M☉',
    distancePc: 5.3e9,
    distanceText: '5,3 Gpc (≈ 17 milyar ly)',
    spin: 0.72,
    spinText: 'a* = 0,72 ± 0,12',
    discoveryYear: 2019,
    constellation: 'Kuzey/Güney gökküre',
    note: '85 M☉ ve 66 M☉\'lik iki kara deliğin birleşmesiyle oluştu; 100 M☉ üzerindeki orta kütleli sınıfın ilk doğrudan kanıtıdır.',
  },
  {
    // Orosz et al. 2009 (ApJ 697, 573): M = 10.91 ± 1.41 M☉, D = 48.1 kpc; Gou et al. 2009 (ApJ 701, 1076): a* = 0.92 ± 0.06
    id: 'lmc-x1',
    name: 'LMC X-1',
    type: 'stellar',
    typeLabel: 'Yıldızsal',
    massSolar: 10.91,
    massErrSolar: 1.41,
    massText: '10,91 ± 1,41 M☉',
    distancePc: 48100,
    distanceText: '48,1 kpc (Büyük Macellan Bulutu)',
    spin: 0.92,
    spinText: 'a* = 0,92 ± 0,06',
    discoveryYear: 1969,
    constellation: 'Kılıçbalığı (Dorado)',
    note: 'Büyük Macellan Bulutu\'ndaki sürekli aktif X-ışını ikilisi; termal süreklilik yöntemiyle yüksek dönüş hızı doğrulanmıştır.',
  },
]);

// =====================================================================
// 11. ALIŞTIRMA ŞABLONLARI (BH_EXERCISES)
// =====================================================================

function roundSig(x, sig = 4) {
  if (!Number.isFinite(x) || x === 0) return 0;
  const r = Number(x.toPrecision(sig));
  return Object.is(r, -0) ? 0 : r;
}

function numSpec(rawVal, relTol = 0.015, sig = 4) {
  const value = roundSig(rawVal, sig);
  const tol = Math.max(1e-6, Math.abs(rawVal) * relTol);
  return { type: 'number', value, tol };
}

function choiceSpec(rng, correctText, distractors) {
  const options = rng.shuffle([correctText, ...distractors]);
  return { type: 'choice', options, value: options.indexOf(correctText) };
}

function makeLabels(parts) {
  return parts.map((p, i) => ({ label: String.fromCharCode(97 + i), ...p }));
}

function fmtLatexSci(x, digits = 2) {
  if (x === 0) return '0';
  const [m, e] = Math.abs(x).toExponential(digits).split('e');
  const exp = parseInt(e, 10);
  const sgn = x < 0 ? '-' : '';
  return `${sgn}${m} \\times 10^{${exp}}`;
}

// 1. Schwarzschild yarıçapı ve yoğunluk
const T_SCHWARZSCHILD = {
  id: 'bh-schwarzschild-yaricap',
  topic: 'Schwarzschild Geometrisi',
  title: 'Schwarzschild Yarıçapı ve Ortalama Yoğunluk',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const pick = rng.pick(['earth', 'sun', 'person', 'sgrA']);
      if (pick === 'earth') {
        const k = rng.pick([1, 2, 3, 5]);
        const m = k * M_EARTH;
        const rsMm = schwarzschildRadius(m) * 1e3;
        const name = k === 1 ? 'Dünya' : `Dünya\'nın $${k}$ katı kütleli bir gezegen`;
        return {
          title: 'Gezegenin Schwarzschild Yarıçapı',
          story: `Bir cismin tüm kütlesi Schwarzschild yarıçapı $r_s = 2GM/c^2$ içine sıkıştırılırsa olay ufku oluşur. ${name} için kütle $M = ${fmtLatexSci(m, 3)}\\,\\text{kg}$ olarak veriliyor.`,
          parts: makeLabels([
            {
              prompt: `Bu kütlenin Schwarzschild yarıçapı $r_s$ kaç **milimetre** ($\\text{mm}$) olur?`,
              kind: 'answer',
              answer: numSpec(rsMm, 0.015),
              hints: [
                '$r_s = \\frac{2GM}{c^2}$ formülünü kullanın ($G = 6,674\\times 10^{-11}$, $c = 2,998\\times 10^8\\,\\text{m/s}$).',
                'Bulduğunuz metre değerini milimetreye çevirmek için $10^3$ ile çarpın.',
                `Dünya ($1\\,M_\\oplus$) için $r_s \\approx 8,87\\,\\text{mm}$'dir; kütleyle doğru orantılı ölçekleyin.`,
              ],
              solution: [
                `$r_s = \\frac{2GM}{c^2} = \\frac{2 \\times 6,6743\\times 10^{-11} \\times ${fmtLatexSci(m, 3)}}{(2,9979\\times 10^8)^2} = ${fmtLatexSci(schwarzschildRadius(m), 3)}\\,\\text{m}$.`,
                `Milimetre cinsinden: $r_s \\approx ${roundSig(rsMm, 4)}\\,\\text{mm}$.`,
              ],
            },
          ]),
        };
      }
      if (pick === 'sun') {
        const mSol = rng.pick([1, 2, 5, 10, 15, 20]);
        const m = solarMassToKg(mSol);
        const rsKm = mToKm(schwarzschildRadius(m));
        return {
          title: 'Yıldız Kütlesinin Olay Ufku',
          story: `Kütlesi $M = ${mSol}\\,M_\\odot$ olan bir yıldız kütleçekimsel çökme geçirerek dönmeyen bir kara deliğe dönüşüyor ($M_\\odot = 1,9885\\times 10^{30}\\,\\text{kg}$).`,
          parts: makeLabels([
            {
              prompt: `Oluşan kara deliğin Schwarzschild yarıçapı $r_s$ kaç **kilometre** ($\\text{km}$) olur?`,
              kind: 'answer',
              answer: numSpec(rsKm, 0.015),
              hints: [
                '$r_s = \\frac{2GM}{c^2}$ formülünü kullanın.',
                '$1\\,M_\\odot$ için $r_{s,\\odot} \\approx 2,953\\,\\text{km}$ değerini $M/M_\\odot$ ile çarpabilirsiniz.',
              ],
              solution: [
                `$1\\,M_\\odot$ için $r_{s,\\odot} = \\frac{2GM_\\odot}{c^2} \\approx 2,9533\\,\\text{km}$.`,
                `$M = ${mSol}\\,M_\\odot$ için $r_s = ${mSol} \\times 2,9533\\,\\text{km} \\approx ${roundSig(rsKm, 4)}\\,\\text{km}$.`,
              ],
            },
          ]),
        };
      }
      if (pick === 'person') {
        const m = rng.int(55, 95);
        const rsM = schwarzschildRadius(m);
        const scaled = rsM * 1e25;
        return {
          title: 'Bir İnsanın Schwarzschild Yarıçapı',
          story: `Kütlesi $m = ${m}\\,\\text{kg}$ olan bir astronotun Schwarzschild yarıçapını proton yarıçapıyla ($\\sim 10^{-15}\\,\\text{m}$) kıyaslamak istiyoruz.`,
          parts: makeLabels([
            {
              prompt: `Astronotun Schwarzschild yarıçapını $10^{-25}\\,\\text{m}$ biriminde hesaplayın (yani $r_s / 10^{-25}\\,\\text{m}$ değerini yazın).`,
              kind: 'answer',
              answer: numSpec(scaled, 0.015),
              hints: [
                '$r_s = \\frac{2Gm}{c^2}$ formülünde $m = ' + m + '\\,\\text{kg}$ yazın.',
                '$\\frac{2G}{c^2} \\approx 1,485\\times 10^{-27}\\,\\text{m/kg}$ katsayısını kütleyle çarpın.',
              ],
              solution: [
                `$r_s = \\frac{2 \\times 6,6743\\times 10^{-11} \\times ${m}}{(2,9979\\times 10^8)^2} = ${fmtLatexSci(rsM, 3)}\\,\\text{m}$.`,
                `$10^{-25}\\,\\text{m}$ biriminde: $r_s / 10^{-25}\\,\\text{m} \\approx ${roundSig(scaled, 4)}$ (bir protondan $10$ milyar kat küçük!).`,
              ],
            },
          ]),
        };
      }
      // Sgr A*
      const mMil = rng.pick([4.0, 4.15, 4.3, 5.0]);
      const m = solarMassToKg(mMil * 1e6);
      const rsMilKm = mToKm(schwarzschildRadius(m)) / 1e6;
      return {
        title: 'Galaksi Merkezi: Sgr A* Ölçeğinde Olay Ufku',
        story: `Galaksimizin merkezindeki Sagittarius A* benzeri bir süperkütleli kara deliğin kütlesi $M = ${mMil}\\times 10^6\\,M_\\odot$ olarak ölçülüyor.`,
        parts: makeLabels([
          {
            prompt: `Bu kara deliğin Schwarzschild yarıçapı kaç **milyon kilometre** ($10^6\\,\\text{km}$) olur?`,
            kind: 'answer',
            answer: numSpec(rsMilKm, 0.015),
            hints: [
              '$r_s = 2,9533\\,\\text{km} \\times (M / M_\\odot)$ bağıntısını kullanın.',
              'Sonucu $10^6\\,\\text{km}$ birimine çevirmek için $10^6$\'ya bölün.',
            ],
            solution: [
              `$r_s = ${mMil}\\times 10^6 \\times 2,9533\\,\\text{km} \\approx ${roundSig(rsMilKm, 4)}\\times 10^6\\,\\text{km}$.`,
              `Milyon km cinsinden cevap: **${roundSig(rsMilKm, 4)}** (Merkür yörüngesinin yaklaşık beşte biri).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mExp = rng.pick([1, 7, 8, 9]);
      const coef = rng.pick([1.5, 2.5, 4.0, 6.5]);
      const mSol = coef * Math.pow(10, mExp);
      const m = solarMassToKg(mSol);
      const rsKm = mToKm(schwarzschildRadius(m));
      const rPhKm = mToKm(photonSphereRadius(m));
      const rho = blackHoleMeanDensity(m);
      const unitScale = mExp === 1 ? 1 : 1e6;
      const unitLbl = mExp === 1 ? '\\text{km}' : '10^6\\,\\text{km}';
      return {
        title: 'Olay Ufku, Foton Küresi ve Ortalama Yoğunluk',
        story: `Dönmeyen bir kara deliğin kütlesi $M = ${mExp === 1 ? mSol : `${coef}\\times 10^{${mExp}}`}\\,M_\\odot$ olarak veriliyor.`,
        parts: makeLabels([
          {
            prompt: `Schwarzschild yarıçapı $r_s$'yi $${unitLbl}$ biriminde hesaplayın.`,
            kind: 'answer',
            answer: numSpec(rsKm / unitScale, 0.015),
            hints: [
              '$r_s = \\frac{2GM}{c^2} \\approx 2,9533\\,(M/M_\\odot)\\,\\text{km}$.',
              mExp === 1 ? 'Doğrudan kilometre cinsinden yazın.' : 'Kilometreyi $10^6$\'ya bölün.',
            ],
            solution: [
              `$r_s = \\frac{2GM}{c^2} \\approx ${roundSig(rsKm / unitScale, 4)}\\,${unitLbl}$.`,
            ],
          },
          {
            prompt: `Foton küresi yarıçapı $r_{\\text{ph}}$ kaç $${unitLbl}$ olur?`,
            kind: 'answer',
            answer: numSpec(rPhKm / unitScale, 0.015),
            hints: [
              'Schwarzschild metriğinde foton küresi $r_{\\text{ph}} = \\frac{3GM}{c^2} = 1,5\\,r_s$ konumundadır.',
            ],
            solution: [
              `$r_{\\text{ph}} = 1,5\\,r_s \\approx ${roundSig(rPhKm / unitScale, 4)}\\,${unitLbl}$.`,
            ],
          },
          {
            prompt: `Bu kara deliğin olay ufku içi ortalama yoğunluğu $\\bar{\\rho} = M / (\\frac{4}{3}\\pi r_s^3)$, suyun yoğunluğundan ($1000\\,\\text{kg/m}^3$) **daha düşük** müdür?`,
            kind: 'answer',
            answer: { type: 'yesno', value: rho < 1000 },
            hints: [
              '$\\bar{\\rho} \\propto M^{-2}$ olduğundan büyük kütleli kara deliklerin ortalama yoğunluğu şaşırtıcı derecede düşüktür.',
              'Suyun yoğunluğu $M \\approx 1,36\\times 10^8\\,M_\\odot$ civarında yakalanır.',
            ],
            solution: [
              `$\\bar{\\rho} = \\frac{M}{\\frac{4}{3}\\pi r_s^3} = ${fmtLatexSci(rho, 2)}\\,\\text{kg/m}^3$.`,
              rho < 1000
                ? 'Bu değer $1000\\,\\text{kg/m}^3$\'ten küçüktür: **Evet**.'
                : 'Bu değer $1000\\,\\text{kg/m}^3$\'ten büyüktür: **Hayır**.',
            ],
          },
        ]),
      };
    }

    // zorlayici: verilen ortalama yoğunluktan M ve yüzey kütleçekimi κ
    const targetRho = rng.pick([1000, 100, 1.2, 5514]);
    const labelMap = {
      1000: 'sıvı su ($1000\\,\\text{kg/m}^3$)',
      100: 'hafif köpük ($100\\,\\text{kg/m}^3$)',
      1.2: 'deniz seviyesindeki hava ($1,2\\,\\text{kg/m}^3$)',
      5514: 'Dünya\'nın ortalama yoğunluğu ($5514\\,\\text{kg/m}^3$)',
    };
    // rho = 3 c^6 / (32 pi G^3 M^2) -> M = sqrt(3 c^6 / (32 pi G^3 rho))
    const mKg = Math.sqrt((3 * C6) / (32 * Math.PI * G * G * G * targetRho));
    const mIn1e8 = kgToSolarMass(mKg) / 1e8;
    const kappa = surfaceGravity(mKg);
    return {
      title: 'Ters Problem: Hedef Yoğunluk ve Yüzey Kütleçekimi',
      story: `Ortalama yoğunluğu $\\bar{\\rho} = M / (\\frac{4}{3}\\pi r_s^3)$ tam olarak ${labelMap[targetRho]} değerine eşit olan bir Schwarzschild kara deliği düşünüyoruz.`,
      parts: makeLabels([
        {
          prompt: `Bu kara deliğin kütlesi $M$ kaç **$10^8\\,M_\\odot$** olmalıdır?`,
          kind: 'answer',
          answer: numSpec(mIn1e8, 0.02),
          hints: [
            '$r_s = 2GM/c^2$ ifadesini $\\bar{\\rho} = \\frac{3M}{4\\pi r_s^3}$ içine yerleştirin.',
            '$\\bar{\\rho} = \\frac{3c^6}{32\\pi G^3 M^2} \\implies M = \\sqrt{\\frac{3c^6}{32\\pi G^3 \\bar{\\rho}}}$.',
          ],
          solution: [
            `$M = \\sqrt{\\frac{3c^6}{32\\pi G^3 \\bar{\\rho}}} = ${fmtLatexSci(mKg, 3)}\\,\\text{kg}$.`,
            `Güneş kütlesi cinsinden: $M / M_\\odot = ${fmtLatexSci(kgToSolarMass(mKg), 3)}$, yani **${roundSig(mIn1e8, 4)}** $\\times 10^8\\,M_\\odot$.`,
          ],
        },
        {
          prompt: `Bu kara deliğin yüzey kütleçekimi $\\kappa = c^4/(4GM)$ kaç **$\\text{m/s}^2$** olur?`,
          kind: 'answer',
          answer: numSpec(kappa, 0.02),
          hints: [
            '$\\kappa = \\frac{c^4}{4GM}$ formülünü bulduğunuz $M$ değeriyle uygulayın.',
            'Süperkütleli kara deliklerde $\\kappa$ şaşırtıcı biçimde gezegen yüzey ivmeleri mertebesindedir.',
          ],
          solution: [
            `$\\kappa = \\frac{c^4}{4GM} \\approx ${roundSig(kappa, 4)}\\,\\text{m/s}^2$ ($\\approx ${roundSig(kappa / G0, 3)}\\,g$).`,
          ],
        },
      ]),
    };
  },
};

// 2. Gölge açısal çapı (EHT)
const T_SHADOW = {
  id: 'bh-golge-acisal-cap',
  topic: 'Schwarzschild Geometrisi',
  title: 'Kara Delik Gölgesi ve Açısal Çap (EHT)',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mSol = rng.pick([5, 10, 15, 25, 40]);
      const m = solarMassToKg(mSol);
      const bcKm = mToKm(shadowRadius(m));
      return {
        title: 'Kritik Çarpışma Parametresi ve Gölge Yarıçapı',
        story: `Uzak bir gözlemcinin gördüğü kara delik gölgesinin yarıçapı, Schwarzschild yarıçapı $r_s$ değil, kritik çarpışma parametresi $b_c = 3\\sqrt{3}\\,GM/c^2$ tarafından belirlenir. Kütlesi $M = ${mSol}\\,M_\\odot$ olan bir Schwarzschild kara deliğini inceleyin.`,
        parts: makeLabels([
          {
            prompt: `Gölge yarıçapı $b_c$ kaç **kilometre** ($\\text{km}$) olur?`,
            kind: 'answer',
            answer: numSpec(bcKm, 0.015),
            hints: [
              '$b_c = 3\\sqrt{3}\\,\\frac{GM}{c^2} = \\frac{3\\sqrt{3}}{2}\\,r_s \\approx 2,598\\,r_s$.',
              `Önce $r_s \\approx ${roundSig(mToKm(schwarzschildRadius(m)), 4)}\\,\\text{km}$ değerini bulun ve $2,598$ ile çarpın.`,
            ],
            solution: [
              `$r_g = GM/c^2 \\approx ${roundSig(mToKm(gravRadius(m)), 4)}\\,\\text{km}$.`,
              `$b_c = 3\\sqrt{3}\\,r_g \\approx 5,1962 \\times ${roundSig(mToKm(gravRadius(m)), 4)} \\approx ${roundSig(bcKm, 4)}\\,\\text{km}$.`,
            ],
          },
          {
            prompt: `Kara delik gölgesinin yarıçapı neden olay ufkunun yarıçapından ($r_s$) yaklaşık $2,6$ kat daha büyük görünür?`,
            kind: 'answer',
            answer: choiceSpec(
              rng,
              'Foton küresi yakınından geçen ışık ışınları güçlü kütleçekimsel merceklenmeyle bükülür ve $b < 3\\sqrt{3}\\,GM/c^2$ olan tüm fotonlar yakalanır',
              [
                'Yığılma diskinin sıcaklığı olay ufkunu fiziksel olarak genişletir',
                'Hawking ışıması ufkun çevresinde karanlık bir sis oluşturur',
                'Kütleçekimsel kırmızıya kayma cismin koordinat yarıçapını iki katına çıkarır',
              ],
            ),
            hints: [
              'Işık ışınlarının $r = 3GM/c^2$ foton küresi çevresindeki kritik yörüngesini düşünün.',
            ],
            solution: [
              'Çarpışma parametresi $b < b_c = 3\\sqrt{3}\\,GM/c^2$ olan her foton foton küresini aşıp kara deliğe düşer; uzaktan bakıldığında bu yakalama konisi $b_c \\approx 2,6\\,r_s$ yarıçaplı karanlık bir gölge olarak görünür.',
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const scenarios = [
        { name: 'Sgr A* benzeri', mSol: rng.pick([3.8e6, 4.15e6, 4.5e6]), dVal: rng.pick([7.9, 8.28, 8.6]), dUnit: 'kpc', dM: v => kpcToM(v) },
        { name: 'M87* benzeri', mSol: rng.pick([5.8e9, 6.5e9, 7.2e9]), dVal: rng.pick([15.5, 16.8, 18.2]), dUnit: 'Mpc', dM: v => mpcToM(v) },
      ];
      const sc = rng.pick(scenarios);
      const m = solarMassToKg(sc.mSol);
      const D = sc.dM(sc.dVal);
      const thetaUas = radToUas(shadowAngularDiameter(m, D));
      return {
        title: `EHT Gözlemi: ${sc.name} Kara Delik Gölgesi`,
        story: `Bir radyo interferometresi, kütlesi $M = ${fmtLatexSci(sc.mSol, 2)}\\,M_\\odot$ ve uzaklığı $D = ${sc.dVal}\\,\\text{${sc.dUnit}}$ olan ${sc.name} bir kara deliğin gölgesini hedefliyor.`,
        parts: makeLabels([
          {
            prompt: `Kara delik gölgesinin açısal çapı $\\theta = 2b_c/D$ kaç **mikroyay saniyesi** ($\\mu\\text{as}$) olur?`,
            kind: 'answer',
            answer: numSpec(thetaUas, 0.02),
            hints: [
              '$b_c = 3\\sqrt{3}\\,GM/c^2$ ve açısal çap $\\theta = 2b_c / D$ (radyan) formüllerini kullanın.',
              'Radyanı $\\mu\\text{as}$ birimine çevirmek için $2,06265\\times 10^{11}$ ile çarpın ($1\\,\\text{pc} = 3,0857\\times 10^{16}\\,\\text{m}$).',
            ],
            solution: [
              `$b_c = 3\\sqrt{3}\\,GM/c^2 = ${fmtLatexSci(shadowRadius(m), 3)}\\,\\text{m}$ ve $D = ${fmtLatexSci(D, 3)}\\,\\text{m}$.`,
              `$\\theta = \\frac{2b_c}{D} = ${fmtLatexSci(shadowAngularDiameter(m, D), 3)}\\,\\text{rad} \\approx ${roundSig(thetaUas, 4)}\\,\\mu\\text{as}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: ters problem — ölçülen açısal çaptan kütle çıkarımı
    const thetaUas = rng.pick([25, 32, 40, 48, 55]);
    const distMpc = rng.pick([12, 16.8, 22, 30]);
    const D = mpcToM(distMpc);
    const thetaRad = uasToRad(thetaUas);
    const bc = 0.5 * thetaRad * D;
    const mKg = (bc * C2) / (B_CRIT_GEOM * G);
    const mBillion = kgToSolarMass(mKg) / 1e9;
    return {
      title: 'Gölge Çapından Süperkütleli Kara Delik Tartımı',
      story: `Uzaklığı $D = ${distMpc}\\,\\text{Mpc}$ olan dev bir eliptik galaksinin merkezinde EHT gözlemiyle gölge açısal çapı $\\theta = ${thetaUas}\\,\\mu\\text{as}$ olarak ölçülüyor (Schwarzschild modeli varsayın).`,
      parts: makeLabels([
        {
          prompt: `Bu ölçümden çıkarılan kara delik kütlesi kaç **milyar Güneş kütlesi** ($10^9\\,M_\\odot$) olur?`,
          kind: 'answer',
          answer: numSpec(mBillion, 0.02),
          hints: [
            '$\\theta = \\frac{6\\sqrt{3}\\,GM}{c^2 D}$ bağıntısını $M$ için çözün.',
            '$M = \\frac{c^2 D \\theta}{6\\sqrt{3}\\,G}$ (burada $\\theta$ radyan, $D$ metre cinsinden).',
          ],
          solution: [
            `$\\theta = ${thetaUas}\\times 10^{-6}\\,\\text{arcsec} = ${fmtLatexSci(thetaRad, 3)}\\,\\text{rad}$, $D = ${fmtLatexSci(D, 3)}\\,\\text{m}$.`,
            `$M = \\frac{c^2 D \\theta}{6\\sqrt{3}\\,G} = ${fmtLatexSci(mKg, 3)}\\,\\text{kg} \\approx ${roundSig(mBillion, 4)}\\times 10^9\\,M_\\odot$.`,
          ],
        },
        {
          prompt: `Gölge çapının fiziksel olay ufku çapına oranı $\\theta_{\\text{gölge}} / (2r_s/D)$ kaçtır?`,
          kind: 'answer',
          answer: numSpec(B_CRIT_GEOM / 2, 0.01),
          hints: [
            '$b_c = 3\\sqrt{3}\\,GM/c^2$ ve $r_s = 2GM/c^2$ oranını alın.',
          ],
          solution: [
            `$\\frac{b_c}{r_s} = \\frac{3\\sqrt{3}}{2} \\approx ${roundSig(B_CRIT_GEOM / 2, 4)}$ (kütleden ve uzaklıktan bağımsız evrensel Schwarzschild oranı).`,
          ],
        },
      ]),
    };
  },
};

// 3. Zaman genişlemesi
const T_TIME_DILATION = {
  id: 'bh-zaman-genislemesi',
  topic: 'Saatler ve Işık',
  title: 'Olay Ufku Yakınında Zaman Genişlemesi',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const k = rng.pick([1.25, 1.5, 2, 2.5, 4, 5]);
      const tFar = rng.pick([10, 24, 48, 100]);
      const factor = Math.sqrt(1 - 1 / k);
      const tau = tFar * factor;
      return {
        title: 'Statik Gözlemcinin Saati',
        story: `Bir uzay sondası, roket iticileriyle bir Schwarzschild kara deliğinden $r = ${k}\\,r_s$ uzaklığında sabit konumda duruyor. Uzaktaki ana gemide $t = ${tFar}\\,\\text{saat}$ geçiyor.`,
        parts: makeLabels([
          {
            prompt: `Sondanın zaman genişlemesi oranı $d\\tau/dt$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(factor, 0.015),
            hints: [
              'Statik gözlemci için $\\frac{d\\tau}{dt} = \\sqrt{1 - \\frac{r_s}{r}}$.',
              `$r/r_s = ${k}$ yerine koyun.`,
            ],
            solution: [
              `$\\frac{d\\tau}{dt} = \\sqrt{1 - \\frac{1}{${k}}} \\approx ${roundSig(factor, 4)}$.`,
            ],
          },
          {
            prompt: `Aynı aralıkta sondanın kendi saatinde kaç **saat** öz zaman ($\\tau$) geçer?`,
            kind: 'answer',
            answer: numSpec(tau, 0.015),
            hints: [
              '$\\Delta\\tau = \\Delta t \\cdot \\sqrt{1 - r_s/r}$.',
            ],
            solution: [
              `$\\Delta\\tau = ${tFar} \\times ${roundSig(factor, 4)} \\approx ${roundSig(tau, 4)}\\,\\text{saat}$.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const k = rng.pick([3, 3.5, 4, 5, 6]); // r / r_s >= 3 (ISCO ve ötesi)
      const fStat = Math.sqrt(1 - 1 / k);
      const fOrb = Math.sqrt(1 - 1.5 / k);
      return {
        title: 'Statik Saat mi, Yörüngedeki Saat mi?',
        story: `Aynı $r = ${k}\\,r_s$ yarıçapında iki saat bulunuyor: **A saati** iticilerle sabit duruyor, **B saati** ise serbest dairesel yörüngede dolanıyor.`,
        parts: makeLabels([
          {
            prompt: `Dairesel yörüngedeki B saatinin zaman genişlemesi oranı $d\\tau_B/dt$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(fOrb, 0.015),
            hints: [
              'Dairesel yörüngede hem kütleçekimsel hem hız kaynaklı zaman genişlemesi birleşir: $\\frac{d\\tau}{dt} = \\sqrt{1 - \\frac{3GM}{c^2 r}} = \\sqrt{1 - \\frac{3 r_s}{2 r}}$.',
              `$r/r_s = ${k}$ değerini yerleştirin.`,
            ],
            solution: [
              `$\\frac{d\\tau_B}{dt} = \\sqrt{1 - \\frac{3}{2 \\times ${k}}} = \\sqrt{1 - ${roundSig(1.5 / k, 4)}} \\approx ${roundSig(fOrb, 4)}$.`,
            ],
          },
          {
            prompt: `Hangi saat uzaktaki gözlemciye göre **daha yavaş** ilerler?`,
            kind: 'answer',
            answer: choiceSpec(
              rng,
              'Yörüngedeki B saati (ek özel görelilik hız etkisinden dolayı)',
              [
                'Sabit duran A saati (iticilerin ivmesi zamanı daha çok yavaşlatır)',
                'Aynı $r$ yarıçapında oldukları için ikisi tam aynı hızda ilerler',
                'B saati serbest düşüşte olduğu için uzaktaki saatle eşzamanlıdır',
              ],
            ),
            hints: [
              `$d\\tau_A/dt = \\sqrt{1 - 1/${k}} \\approx ${roundSig(fStat, 4)}$ ile $d\\tau_B/dt \\approx ${roundSig(fOrb, 4)}$ değerlerini karşılaştırın.`,
            ],
            solution: [
              `$d\\tau_B/dt = \\sqrt{1 - \\frac{3}{2k}} < \\sqrt{1 - \\frac{1}{k}} = d\\tau_A/dt$ olduğundan yörüngedeki **B saati** daha yavaş ilerler.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: hedef zaman genişlemesi için r/r_s
    const alpha = rng.pick([0.1, 0.2, 0.25, 0.4, 0.5, 0.8]);
    const rOverRs = 1 / (1 - alpha * alpha);
    const stablePossible = rOverRs >= 3;
    return {
      title: 'Hedef Zaman Genişlemesi ve Kararlı Yörünge Koşulu',
      story: `Bir gözlem istasyonunda statik saatlerin uzaktaki saatlere göre $d\\tau/dt = ${alpha}$ oranında akması isteniyor.`,
      parts: makeLabels([
        {
          prompt: `İstasyonun bulunması gereken yarıçap $r / r_s$ kaç olmalıdır?`,
          kind: 'answer',
          answer: numSpec(rOverRs, 0.015),
          hints: [
            '$\\sqrt{1 - r_s/r} = \\alpha$ denkleminin karesini alın.',
            '$\\frac{r}{r_s} = \\frac{1}{1 - \\alpha^2}$.',
          ],
          solution: [
            `$1 - \\frac{r_s}{r} = ${alpha}^2 = ${roundSig(alpha * alpha, 4)} \\implies \\frac{r}{r_s} = \\frac{1}{1 - ${roundSig(alpha * alpha, 4)}} \\approx ${roundSig(rOverRs, 4)}$.`,
          ],
        },
        {
          prompt: `Bu $r$ yarıçapında bir Schwarzschild kara deliği çevresinde **kararlı dairesel yörünge** ($r \\ge r_{\\text{ISCO}}$) mümkün müdür?`,
          kind: 'answer',
          answer: { type: 'yesno', value: stablePossible },
          hints: [
            'Schwarzschild kara deliğinde ISCO yarıçapı $r_{\\text{ISCO}} = 6GM/c^2 = 3\\,r_s$ konumundadır.',
            `Bulduğunuz $r/r_s \\approx ${roundSig(rOverRs, 4)}$ değerini $3$ ile kıyaslayın.`,
          ],
          solution: [
            `Kararlı dairesel yörünge için $r/r_s \\ge 3$ gerekir; burada $r/r_s \\approx ${roundSig(rOverRs, 4)}$ olduğundan cevap **${stablePossible ? 'Evet' : 'Hayır'}**.`,
          ],
        },
      ]),
    };
  },
};

// 4. Kütleçekimsel kırmızıya kayma
const T_REDSHIFT = {
  id: 'bh-kirmiziya-kayma',
  topic: 'Saatler ve Işık',
  title: 'Kütleçekimsel Kırmızıya Kayma ve Tayf Çizgisi',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const lines = [
      { name: 'Hidrojen Hα', lam: 656.3 },
      { name: 'Hidrojen Hβ', lam: 486.1 },
      { name: 'Sodyum D', lam: 589.0 },
      { name: 'Oksijen [O III]', lam: 500.7 },
    ];
    if (level === 'isinma') {
      const ln = rng.pick(lines);
      const k = rng.pick([1.5, 2, 2.5, 3, 4, 5]);
      const onePlusZ = 1 / Math.sqrt(1 - 1 / k);
      const z = onePlusZ - 1;
      const lamObs = ln.lam * onePlusZ;
      return {
        title: `${ln.name} Çizgisinin Kütleçekimsel Kayması`,
        story: `Durgun bir gaz bulutu, bir Schwarzschild kara deliğinden $r = ${k}\\,r_s$ uzaklığında laboratuvar dalga boyu $\\lambda_0 = ${ln.lam}\\,\\text{nm}$ olan **${ln.name}** ışığını yayıyor.`,
        parts: makeLabels([
          {
            prompt: `Kütleçekimsel kırmızıya kayma parametresi $z$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(z, 0.015),
            hints: [
              '$1 + z = \\frac{1}{\\sqrt{1 - r_s/r}}$ formülünü kullanın.',
              '$z = (1 + z) - 1$ olarak hesaplayın.',
            ],
            solution: [
              `$1 + z = \\frac{1}{\\sqrt{1 - 1/${k}}} \\approx ${roundSig(onePlusZ, 4)} \\implies z \\approx ${roundSig(z, 4)}$.`,
            ],
          },
          {
            prompt: `Uzaktaki teleskop bu çizgiyi kaç **nanometre** ($\\text{nm}$) dalga boyunda gözlemler?`,
            kind: 'answer',
            answer: numSpec(lamObs, 0.015),
            hints: [
              '$\\lambda_{\\text{göz}} = (1 + z)\\,\\lambda_0$.',
            ],
            solution: [
              `$\\lambda_{\\text{göz}} = ${roundSig(onePlusZ, 4)} \\times ${ln.lam}\\,\\text{nm} \\approx ${roundSig(lamObs, 4)}\\,\\text{nm}$.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const ln = rng.pick(lines);
      const kTrue = rng.pick([1.25, 1.6, 2.0, 2.5, 4.0]);
      const onePlusZ = 1 / Math.sqrt(1 - 1 / kTrue);
      const lamObs = roundSig(ln.lam * onePlusZ, 4);
      const zObs = lamObs / ln.lam - 1;
      const kCalc = 1 / (1 - 1 / ((1 + zObs) * (1 + zObs)));
      return {
        title: 'Gözlenen Tayf Çizgisinden Yayım Konumunu Bulma',
        story: `Laboratuvar dalga boyu $\\lambda_0 = ${ln.lam}\\,\\text{nm}$ olan ${ln.name} çizgisi, statik bir kaynaktan yayılıp uzakta $\\lambda_{\\text{göz}} = ${lamObs}\\,\\text{nm}$ olarak ölçülüyor.`,
        parts: makeLabels([
          {
            prompt: `Kaynağın kara deliğe uzaklığı $r / r_s$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(kCalc, 0.02),
            hints: [
              'Önce $1 + z = \\lambda_{\\text{göz}} / \\lambda_0$ oranını hesaplayın.',
              '$1 - \\frac{r_s}{r} = \\frac{1}{(1+z)^2} \\implies \\frac{r}{r_s} = \\frac{(1+z)^2}{(1+z)^2 - 1}$.',
            ],
            solution: [
              `$1 + z = \\frac{${lamObs}}{${ln.lam}} \\approx ${roundSig(1 + zObs, 4)}$.`,
              `$\\frac{r}{r_s} = \\frac{1}{1 - (1+z)^{-2}} \\approx ${roundSig(kCalc, 4)}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: dairesel yörüngedeki yığılma diski (Doppler + kütleçekimsel)
    const k = rng.pick([3, 4, 5, 6]); // r / r_s >= 3
    const ln = rng.pick(lines);
    const m = solarMassToKg(10);
    const r = k * schwarzschildRadius(m);
    const beta = circularOrbitSpeed(m, r) / C;
    const redApp = circularOrbitRedshift(m, r, 0);
    const redRec = circularOrbitRedshift(m, r, Math.PI);
    const lamApp = ln.lam * redApp.onePlusZ;
    const lamRec = ln.lam * redRec.onePlusZ;
    return {
      title: 'Dönen Diskte Birleşik (Kütleçekimsel + Doppler) Kayma',
      story: `Kenardan bakılan bir yığılma diskinde $r = ${k}\\,r_s$ yarıçapındaki dairesel yörüngedeki plazma $\\lambda_0 = ${ln.lam}\\,\\text{nm}$ (${ln.name}) ışığı yayıyor. Diskin bir kenarı gözlemciye doğrudan yaklaşırken ($\\psi = 0$), karşı kenarı doğrudan uzaklaşıyor ($\\psi = \\pi$).`,
      parts: makeLabels([
        {
          prompt: `Yerel statik gözlemcinin bu yarıçapta ölçtüğü yörünge hızı $v / c$ kaçtır?`,
          kind: 'answer',
          answer: numSpec(beta, 0.015),
          hints: [
            '$v = \\sqrt{\\frac{GM}{r - r_s}} \\implies \\frac{v}{c} = \\sqrt{\\frac{1}{2(r/r_s - 1)}}$.',
          ],
          solution: [
            `$\\beta = \\frac{v}{c} = \\sqrt{\\frac{1}{2(${k} - 1)}} \\approx ${roundSig(beta, 4)}$.`,
          ],
        },
        {
          prompt: `Gözlemciye **yaklaşan** disk kenarından gelen ışığın gözlenen dalga boyu $\\lambda_{\\text{yak}}$ kaç **nm** olur?`,
          kind: 'answer',
          answer: numSpec(lamApp, 0.02),
          hints: [
            'Birleşik faktör: $1 + z = \\frac{1 - \\beta \\cos\\psi}{\\sqrt{1 - 3r_s/(2r)}}$.',
            'Yaklaşan kenarda $\\cos\\psi = +1$ alın.',
          ],
          solution: [
            `$1 + z_{\\text{yak}} = \\frac{1 - ${roundSig(beta, 4)}}{\\sqrt{1 - 3/(2\\times ${k})}} \\approx ${roundSig(redApp.onePlusZ, 4)}$ (maviye kayma!).`,
            `$\\lambda_{\\text{yak}} = ${roundSig(redApp.onePlusZ, 4)} \\times ${ln.lam} \\approx ${roundSig(lamApp, 4)}\\,\\text{nm}$.`,
          ],
        },
        {
          prompt: `Gözlemciden **uzaklaşan** disk kenarından gelen ışığın gözlenen dalga boyu $\\lambda_{\\text{uzak}}$ kaç **nm** olur?`,
          kind: 'answer',
          answer: numSpec(lamRec, 0.02),
          hints: [
            'Uzaklaşan kenarda $\\cos\\psi = -1$ olduğundan $1 + z = \\frac{1 + \\beta}{\\sqrt{1 - 3r_s/(2r)}}$.',
          ],
          solution: [
            `$1 + z_{\\text{uzak}} = \\frac{1 + ${roundSig(beta, 4)}}{\\sqrt{1 - 3/(2\\times ${k})}} \\approx ${roundSig(redRec.onePlusZ, 4)}$.`,
            `$\\lambda_{\\text{uzak}} \\approx ${roundSig(lamRec, 4)}\\,\\text{nm}$ (geniş asimetrik tayf çizgisinin kırmızı kanadı).`,
          ],
        },
      ]),
    };
  },
};

// 5. ISCO ve yörünge periyodu
const T_ISCO_PERIOD = {
  id: 'bh-isco-ve-periyot',
  topic: 'Jeodezikler ve Yörüngeler',
  title: 'ISCO Yarıçapı, Yörünge Hızı ve Periyot',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mSol = rng.pick([5, 8, 10, 14, 20, 30]);
      const m = solarMassToKg(mSol);
      const rIscoKm = mToKm(schwarzschildIsco(m));
      const testM = rng.pick([4.5, 5.0, 5.5, 7.0, 8.0]);
      return {
        title: 'En İçteki Kararlı Dairesel Yörünge (ISCO)',
        story: `Kütlesi $M = ${mSol}\\,M_\\odot$ olan bir Schwarzschild kara deliği çevresinde ince bir madde halkası dönüyor.`,
        parts: makeLabels([
          {
            prompt: `ISCO yarıçapı $r_{\\text{ISCO}} = 6GM/c^2$ kaç **kilometre** ($\\text{km}$) olur?`,
            kind: 'answer',
            answer: numSpec(rIscoKm, 0.015),
            hints: [
              '$r_{\\text{ISCO}} = 3\\,r_s = 6\\,GM/c^2$.',
              `$1\\,M_\\odot$ için $r_{\\text{ISCO}} \\approx 8,860\\,\\text{km}$ değerini $${mSol}$ ile çarpın.`,
            ],
            solution: [
              `$r_{\\text{ISCO}} = 6\\,\\frac{GM}{c^2} = 3\\,r_s \\approx ${roundSig(rIscoKm, 4)}\\,\\text{km}$.`,
            ],
          },
          {
            prompt: `Bu kara delikte $r = ${testM}\\,GM/c^2$ yarıçapındaki bir dairesel yörünge **kararlı** mıdır?`,
            kind: 'answer',
            answer: { type: 'yesno', value: testM >= 6 },
            hints: [
              'Schwarzschild metriğinde kararlı dairesel yörüngeler yalnızca $r \\ge 6\\,GM/c^2$ için vardır.',
            ],
            solution: [
              testM >= 6
                ? `$${testM}\\,M \\ge 6\\,M$ olduğundan yörünge kararlıdır: **Evet**.`
                : `$${testM}\\,M < 6\\,M$ olduğundan etkin potansiyelin ikinci türevi negatiftir ve yörünge kararsızdır: **Hayır**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mSol = rng.pick([5, 10, 15, 20, 30]);
      const m = solarMassToKg(mSol);
      const rIsco = schwarzschildIsco(m);
      const { coordPeriod } = circularOrbitPeriod(m, rIsco);
      const periodMs = coordPeriod * 1e3;
      const freqHz = 1 / coordPeriod;
      return {
        title: 'Yıldızsal Kara Delikte ISCO Yörünge Periyodu',
        story: `Kütlesi $M = ${mSol}\\,M_\\odot$ olan dönmeyen bir kara deliğin tam ISCO yarıçapında ($r = 6GM/c^2$) dönen bir plazma topağı gözlemleniyor.`,
        parts: makeLabels([
          {
            prompt: `Uzaktaki gözlemcinin ölçtüğü yörünge periyodu $T_{\\text{koord}}$ kaç **milisaniye** ($\\text{ms}$) olur?`,
            kind: 'answer',
            answer: numSpec(periodMs, 0.015),
            hints: [
              'Schwarzschild koordinatlarında Kepler biçimi korunur: $T_{\\text{koord}} = 2\\pi\\sqrt{\\frac{r^3}{GM}}$.',
              '$r = 6GM/c^2$ yazılırsa $T_{\\text{ISCO}} = 12\\sqrt{6}\\,\\pi\\,\\frac{GM}{c^3} \\approx 0,4548\\,(M/M_\\odot)\\,\\text{ms}$.',
            ],
            solution: [
              `$r_{\\text{ISCO}} = ${fmtLatexSci(rIsco, 3)}\\,\\text{m}$.`,
              `$T_{\\text{koord}} = 2\\pi\\sqrt{\\frac{r_{\\text{ISCO}}^3}{GM}} = 12\\sqrt{6}\\,\\pi\\,\\frac{GM}{c^3} \\approx ${roundSig(periodMs, 4)}\\,\\text{ms}$.`,
            ],
          },
          {
            prompt: `Bu yörüngenin gözlenen dönme frekansı $f_{\\text{yör}} = 1/T_{\\text{koord}}$ kaç **Hz** olur?`,
            kind: 'answer',
            answer: numSpec(freqHz, 0.015),
            hints: [
              '$T_{\\text{koord}}$ değerini saniyeye çevirip tersini alın.',
            ],
            solution: [
              `$f_{\\text{yör}} = \\frac{1}{${roundSig(coordPeriod, 4)}\\,\\text{s}} \\approx ${roundSig(freqHz, 4)}\\,\\text{Hz}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: Sgr A* ölçeğinde koordinat vs öz periyot + belirli r'de E ve L
    const mMil = rng.pick([3.5, 4.15, 5.0, 6.0]);
    const m = solarMassToKg(mMil * 1e6);
    const rIsco = schwarzschildIsco(m);
    const { coordPeriod, properPeriod } = circularOrbitPeriod(m, rIsco);
    const rGeom = rng.pick([7, 8, 9, 10, 12]);
    const orb = circularOrbitParams(rGeom);
    return {
      title: 'ISCO Öz Periyodu ve Dairesel Yörünge Enerjisi',
      story: `Kütlesi $M = ${mMil}\\times 10^6\\,M_\\odot$ olan bir süperkütleli kara deliğin ISCO yörüngesindeki sıcak bir gaz kümesini ve $r = ${rGeom}\\,GM/c^2$ yarıçapındaki bir yörüngeyi analiz ediyoruz.`,
      parts: makeLabels([
        {
          prompt: `ISCO\'daki gaz kümesinin kendi saatine göre ölçülen **öz yörünge periyodu** $T_{\\text{öz}}$ kaç **dakika** olur?`,
          kind: 'answer',
          answer: numSpec(properPeriod / 60, 0.015),
          hints: [
            'Önce $T_{\\text{koord}} = 12\\sqrt{6}\\,\\pi\\,\\frac{GM}{c^3}$ koordinat periyodunu bulun.',
            'ISCO\'da ($r=6M$) zaman genişlemesi $d\\tau/dt = \\sqrt{1 - 3/6} = 1/\\sqrt{2}$ olduğundan $T_{\\text{öz}} = T_{\\text{koord}}/\\sqrt{2}$.',
          ],
          solution: [
            `$T_{\\text{koord}} \\approx ${roundSig(coordPeriod / 60, 4)}\\,\\text{dk}$.`,
            `$T_{\\text{öz}} = T_{\\text{koord}} / \\sqrt{2} \\approx ${roundSig(properPeriod / 60, 4)}\\,\\text{dk}$.`,
          ],
        },
        {
          prompt: `Geometrik birimlerde ($G=c=M=1$) $r = ${rGeom}\\,M$ dairesel yörüngesindeki birim kütle başına özgül enerji $E = \\frac{r-2}{\\sqrt{r(r-3)}}$ kaçtır?`,
          kind: 'answer',
          answer: numSpec(orb.E, 0.01),
          hints: [
            `$r = ${rGeom}$ değerini $E = \\frac{r - 2}{\\sqrt{r(r - 3)}}$ içine koyun.`,
          ],
          solution: [
            `$E = \\frac{${rGeom} - 2}{\\sqrt{${rGeom} \\times ${rGeom - 3}}} = \\frac{${rGeom - 2}}{\\sqrt{${rGeom * (rGeom - 3)}}} \\approx ${roundSig(orb.E, 4)}$.`,
          ],
        },
      ]),
    };
  },
};

// 6. Radyal serbest düşüş
const T_FREE_FALL = {
  id: 'bh-serbest-dusus',
  topic: 'Saatler ve Işık',
  title: 'Radyal Serbest Düşüş ve Tekilliğe Varış Süresi',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mMil = rng.pick([1, 4.15, 10, 50, 100]);
      const m = solarMassToKg(mMil * 1e6);
      const tMax = maxInteriorFallTime(m);
      return {
        title: 'Olay Ufkundan Tekilliğe Azami Süre',
        story: `Kütlesi $M = ${mMil}\\times 10^6\\,M_\\odot$ olan bir Schwarzschild kara deliğinin olay ufkunu geçen bir astronotun tekilliğe ($r = 0$) düşmesi kaçınılmazdır. En uzun olası öz süre, tam ufukta durgun bırakıldığında elde edilen $\\tau_{\\text{maks}} = \\pi GM/c^3$ değeridir.`,
        parts: makeLabels([
          {
            prompt: `Bu kara delikte olay ufkundan tekilliğe düşüş için azami öz süre $\\tau_{\\text{maks}}$ kaç **saniye** olur?`,
            kind: 'answer',
            answer: numSpec(tMax, 0.015),
            hints: [
              '$\\tau_{\\text{maks}} = \\frac{\\pi GM}{c^3}$ formülünü kullanın.',
              '$1\\,M_\\odot$ için $GM_\\odot/c^3 \\approx 4,9255\\,\\mu\\text{s}$ değerini kullanabilirsiniz.',
            ],
            solution: [
              `$\\tau_{\\text{maks}} = \\pi \\times ${mMil}\\times 10^6 \\times 4,9255\\times 10^{-6}\\,\\text{s} \\approx ${roundSig(tMax, 4)}\\,\\text{s}$.`,
            ],
          },
          {
            prompt: `Uzaktaki güvenli bir gözlemci, olay ufkuna yaklaşan astronotu nasıl görür?`,
            kind: 'answer',
            answer: choiceSpec(
              rng,
              'Ufka yaklaştıkça hareketi yavaşlar, ışığı giderek kırmızıya kayar ve sönükleşir; ufkun geçişini sonlu koordinat zamanında asla görmez',
              [
                'Astronot ışık hızını aşarak ufuktan ani bir mavi parlamayla geçer',
                'Astronot tam $\\pi GM/c^3$ koordinat saniyesinde ufku geçip kaybolur',
                'Uzaktaki gözlemci astronotun saatinin giderek hızlandığını görür',
              ],
            ),
            hints: [
              'Radyal düşüşte koordinat zamanı $t(r) \\to \\infty$ iken öz zaman $\\tau(r)$ sonlu kalır.',
            ],
            solution: [
              '$r \\to r_s^+$ iken koordinat zamanı logaritmik olarak sonsuza gider ve kırmızıya kayma $1+z \\to \\infty$ olur; bu yüzden uzak gözlemci görüntünün ufukta donup kırmızıya kayarak sönükleştiğini görür.',
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mMil = rng.pick([4.15, 10, 20]);
      const k0 = rng.pick([3, 4, 5, 6]);
      const m = solarMassToKg(mMil * 1e6);
      const rs = schwarzschildRadius(m);
      const r0 = k0 * rs;
      const fall = radialFreeFall(m, r0, rs);
      return {
        title: 'Durgun Başlangıçtan Ufka ve Tekilliğe Öz Zaman',
        story: `Kütlesi $M = ${mMil}\\times 10^6\\,M_\\odot$ olan bir kara delikten $r_0 = ${k0}\\,r_s$ uzaklığında durgun halde serbest bırakılan bir sonda radyal olarak kara deliğe düşüyor.`,
        parts: makeLabels([
          {
            prompt: `Sondanın kendi saatine göre olay ufkuna ($r = r_s$) ulaşma süresi $\\tau_H$ kaç **saniye** olur?`,
            kind: 'answer',
            answer: numSpec(fall.timeToHorizon, 0.02),
            hints: [
              'Sikloid parametresi $\\eta_H = 2\\arccos(\\sqrt{r_s/r_0})$.',
              '$\\tau(\\eta) = \\sqrt{\\frac{r_0^3}{8GM}}(\\eta + \\sin\\eta)$ formülünü uygulayın.',
            ],
            solution: [
              `$\\eta_H = 2\\arccos(1/\\sqrt{${k0}}) \\approx ${roundSig(fall.eta, 4)}\\,\\text{rad}$.`,
              `$\\tau_H = \\sqrt{\\frac{r_0^3}{8GM}}(\\eta_H + \\sin\\eta_H) \\approx ${roundSig(fall.timeToHorizon, 4)}\\,\\text{s}$.`,
            ],
          },
          {
            prompt: `Sonda ufku geçtikten sonra tekilliğe ($r = 0$) ne kadar ek öz sürede ($\\tau_{H\\to 0}$) ulaşır (**saniye**)?`,
            kind: 'answer',
            answer: numSpec(fall.horizonToSingularity, 0.02),
            hints: [
              'Toplam düşüş süresi $\\tau_{\\text{top}} = \\pi\\sqrt{\\frac{r_0^3}{8GM}}$ değerinden $\\tau_H$\'yi çıkarın.',
            ],
            solution: [
              `$\\tau_{\\text{top}} \\approx ${roundSig(fall.timeToSingularity, 4)}\\,\\text{s}$.`,
              `$\\tau_{H\\to 0} = \\tau_{\\text{top}} - \\tau_H \\approx ${roundSig(fall.horizonToSingularity, 4)}\\,\\text{s}$ ($< \\tau_{\\text{maks}} = ${roundSig(maxInteriorFallTime(m), 4)}\\,\\text{s}$).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: öz zaman vs koordinat zamanı karşılaştırması
    const mMil = rng.pick([5, 10, 25]);
    const k0 = rng.pick([4, 5, 6]);
    const k1 = rng.pick([1.05, 1.1, 1.2]);
    const m = solarMassToKg(mMil * 1e6);
    const rs = schwarzschildRadius(m);
    const fall = radialFreeFall(m, k0 * rs, k1 * rs);
    return {
      title: 'Ufuk Yakınında Öz Zaman ile Koordinat Zamanının Ayrışması',
      story: `Kütlesi $M = ${mMil}\\times 10^6\\,M_\\odot$ olan bir kara delikten $r_0 = ${k0}\\,r_s$ konumunda durgun bırakılan bir kapsül, $r_1 = ${k1}\\,r_s$ konumuna ulaşıyor.`,
      parts: makeLabels([
        {
          prompt: `Kapsülün $r_0$'dan $r_1$'e düşüşünde kendi saatinde geçen öz süre $\\tau$ kaç **saniye** olur?`,
          kind: 'answer',
          answer: numSpec(fall.properTime, 0.02),
          hints: [
            '$\\eta_1 = 2\\arccos(\\sqrt{r_1/r_0})$ açısını hesaplayın.',
            '$\\tau = \\sqrt{\\frac{r_0^3}{8GM}}(\\eta_1 + \\sin\\eta_1)$.',
          ],
          solution: [
            `$\\eta_1 = 2\\arccos(\\sqrt{${k1}/${k0}}) \\approx ${roundSig(fall.eta, 4)}\\,\\text{rad}$.`,
            `$\\tau \\approx ${roundSig(fall.properTime, 4)}\\,\\text{s}$.`,
          ],
        },
        {
          prompt: `Aynı $r_0 \\to r_1$ aralığında uzaktaki gözlemcinin koordinat saatinde geçen süre $t$ kaç **saniye** olur?`,
          kind: 'answer',
          answer: numSpec(fall.coordTime, 0.02),
          hints: [
            '$A = \\sqrt{r_0/r_s - 1}$ olmak üzere $t = \\frac{r_s}{c}\\left[\\ln\\frac{A+\\tan(\\eta_1/2)}{A-\\tan(\\eta_1/2)} + A\\left(\\eta_1 + \\frac{r_0}{2r_s}(\\eta_1 + \\sin\\eta_1)\\right)\\right]$.',
          ],
          solution: [
            `$r_s/c = ${roundSig(rs / C, 4)}\\,\\text{s}$ ve $A = \\sqrt{${k0 - 1}} \\approx ${roundSig(Math.sqrt(k0 - 1), 4)}$.`,
            `Kapalı form sikloid ifadesiyle $t \\approx ${roundSig(fall.coordTime, 4)}\\,\\text{s}$ (öz sürenin $${roundSig(fall.coordTime / fall.properTime, 3)}$ katı).`,
          ],
        },
      ]),
    };
  },
};

// 7. Işık sapması ve kütleçekimsel merceklenme
const T_LENSING = {
  id: 'bh-isik-sapmasi',
  topic: 'Jeodezikler ve Yörüngeler',
  title: 'Kütleçekimsel Merceklenme ve Işık Sapması',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mSol = rng.pick([1, 2, 3, 5]);
      const bRsun = rng.pick([1, 1.5, 2, 4]);
      const m = solarMassToKg(mSol);
      const b = bRsun * R_SUN;
      const defArcsec = radToArcsec(lightDeflectionSI(m, b));
      const bTest = rng.pick([4.5, 5.0, 5.5, 6.5]);
      return {
        title: 'Zayıf Alanda Einstein Işık Sapması',
        story: `Uzak bir yıldızdan gelen ışık ışını, kütlesi $M = ${mSol}\\,M_\\odot$ olan bir cismin merkezinden $b = ${bRsun}\\,R_\\odot$ ($R_\\odot = 6,957\\times 10^8\\,\\text{m}$) çarpışma parametresiyle teğet geçiyor.`,
        parts: makeLabels([
          {
            prompt: `Genel görelilikte zayıf alan ışık sapma açısı $\\Delta\\phi = 4GM/(c^2 b)$ kaç **yay saniyesi** (arcsec) olur?`,
            kind: 'answer',
            answer: numSpec(defArcsec, 0.015),
            hints: [
              'Güneş kenarında ($1\\,M_\\odot$, $1\\,R_\\odot$) sapma açısı yaklaşık $1,751\\,\\text{arcsec}$\'tir.',
              '$\\Delta\\phi \\propto M/b$ ölçeklemesini kullanın.',
            ],
            solution: [
              `$\\Delta\\phi = \\frac{4GM}{c^2 b} = ${fmtLatexSci(lightDeflectionSI(m, b), 3)}\\,\\text{rad}$.`,
              `Yay saniyesi cinsinden: $\\Delta\\phi \\approx ${roundSig(defArcsec, 4)}''$.`,
            ],
          },
          {
            prompt: `Geometrik birimlerde çarpışma parametresi $b = ${bTest}\\,M$ olan bir foton bir Schwarzschild kara deliği tarafından **yakalanır** mı?`,
            kind: 'answer',
            answer: { type: 'yesno', value: bTest < B_CRIT_GEOM },
            hints: [
              'Kritik çarpışma parametresi $b_c = 3\\sqrt{3}\\,M \\approx 5,196\\,M$.',
              '$b < b_c$ ise foton yakalanır, $b > b_c$ ise saparak kaçar.',
            ],
            solution: [
              bTest < B_CRIT_GEOM
                ? `$${bTest}\\,M < 3\\sqrt{3}\\,M \\approx 5,196\\,M$ olduğundan foton olay ufkuna düşer: **Evet**.`
                : `$${bTest}\\,M > 3\\sqrt{3}\\,M \\approx 5,196\\,M$ olduğundan foton en yakın geçişten sonra kaçar: **Hayır**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mSol = rng.pick([10, 20, 50, 100]);
      const dLkpc = rng.pick([1, 2, 4]);
      const dSkpc = dLkpc * 2;
      const m = solarMassToKg(mSol);
      const dL = kpcToM(dLkpc);
      const dS = kpcToM(dSkpc);
      const dLS = dS - dL;
      // Einstein ring radius: theta_E = sqrt((4GM/c^2) * dLS / (dL * dS))
      const thetaERad = Math.sqrt(((4 * G * m) / C2) * (dLS / (dL * dS)));
      const thetaEMas = radToArcsec(thetaERad) * 1e3; // miliyay saniyesi
      return {
        title: 'Yıldızsal Kara Delik ve Einstein Halkası',
        story: `Dünya\'dan $D_L = ${dLkpc}\\,\\text{kpc}$ uzaklıktaki $M = ${mSol}\\,M_\\odot$ kütleli bir kara delik, $D_S = ${dSkpc}\\,\\text{kpc}$ uzaklıktaki ($D_{LS} = ${dSkpc - dLkpc}\\,\\text{kpc}$) arka plan yıldızının tam önünden geçerek bir **Einstein halkası** oluşturuyor.`,
        parts: makeLabels([
          {
            prompt: `Oluşan Einstein halkasının açısal yarıçapı $\\theta_E = \\sqrt{\\frac{4GM}{c^2}\\frac{D_{LS}}{D_L D_S}}$ kaç **miliyay saniyesi** ($\\text{mas}$) olur?`,
            kind: 'answer',
            answer: numSpec(thetaEMas, 0.02),
            hints: [
              '$\\frac{4GM}{c^2} = 2\\,r_s$ değerini metre cinsinden bulun.',
              'Radyan sonucunu yay saniyesine ($206265$) ve ardından $10^3$ ile miliyay saniyesine çevirin.',
            ],
            solution: [
              `$\\frac{4GM}{c^2} = ${fmtLatexSci(2 * schwarzschildRadius(m), 3)}\\,\\text{m}$, $\\frac{D_{LS}}{D_L D_S} = \\frac{1}{${dSkpc}\\,\\text{kpc}} = ${fmtLatexSci(dLS / (dL * dS), 3)}\\,\\text{m}^{-1}$.`,
              `$\\theta_E = ${fmtLatexSci(thetaERad, 3)}\\,\\text{rad} \\approx ${roundSig(thetaEMas, 4)}\\,\\text{mas}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: güçlü alan vs zayıf alan ışık sapması
    const bGeom = rng.pick([16, 20, 24, 30]);
    const weakRad = lightDeflectionWeakField(bGeom);
    const exactRad = lightDeflectionAngle(bGeom, { dphi: 0.002 });
    const exactDeg = (exactRad * 180) / Math.PI;
    const pctExcess = ((exactRad - weakRad) / weakRad) * 100;
    return {
      title: 'Güçlü Alanda Doğrusal Olmayan Işık Sapması',
      story: `Bir foton, bir Schwarzschild kara deliğine geometrik birimlerde ($M=1$) $b = ${bGeom}\\,M$ çarpışma parametresiyle yaklaşarak güçlü alanda sapıyor. Üçüncü mertebe post-Newton açılımı $\\Delta\\phi \\approx \\frac{4}{b} + \\frac{15\\pi}{4 b^2} + \\frac{128}{3 b^3}$ güçlü bükülmeyi yakından verir.`,
      parts: makeLabels([
        {
          prompt: `Zayıf alan formülü ($4/b$) ile hesaplanan sapma açısı kaç **derece** olur?`,
          kind: 'answer',
          answer: numSpec((weakRad * 180) / Math.PI, 0.015),
          hints: [
            `$\\Delta\\phi_{\\text{zayıf}} = 4 / ${bGeom}$ radyan; dereceye çevirmek için $180/\\pi$ ile çarpın.`,
          ],
          solution: [
            `$\\Delta\\phi_{\\text{zayıf}} = \\frac{4}{${bGeom}} = ${roundSig(weakRad, 4)}\\,\\text{rad} \\approx ${roundSig((weakRad * 180) / Math.PI, 4)}^\\circ$.`,
          ],
        },
        {
          prompt: `Tam GR ışık sapma açısı kaç **derece** olur? (Yukarıdaki üç terimli post-Newton açılımı %1,2 içinde doğru sonucu verir.)`,
          kind: 'answer',
          answer: numSpec(exactDeg, 0.025),
          hints: [
            `$\\Delta\\phi \\approx \\frac{4}{b} + \\frac{15\\pi}{4 b^2} + \\frac{128}{3 b^3}$ ifadesini $b = ${bGeom}$ için değerlendirip dereceye çevirin.`,
          ],
          solution: [
            `Tam sayısal RK4 jeodezik integrasyonuyla $\\Delta\\phi_{\\text{tam}} \\approx ${roundSig(exactRad, 4)}\\,\\text{rad} \\approx ${roundSig(exactDeg, 4)}^\\circ$ (zayıf alandan %${roundSig(pctExcess, 3)} daha büyük).`,
          ],
        },
      ]),
    };
  },
};

// 8. Gelgit kuvveti ve spagettileşme
const T_TIDAL = {
  id: 'bh-gelgit-spagettilesme',
  topic: 'Gelgit ve Termodinamik',
  title: 'Gelgit Kuvveti ve Spagettileşme Sınırı',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const isStellar = rng.pick([true, false]);
      const mSol = isStellar ? rng.pick([5, 10, 20]) : rng.pick([4.15e6, 1e7, 1e8]);
      const m = solarMassToKg(mSol);
      const rs = schwarzschildRadius(m);
      const rFactor = isStellar ? rng.pick([100, 150, 200]) : rng.pick([1, 2, 5]);
      const r = rFactor * rs;
      const L = 2;
      const daG = tidalAcceleration(m, r, L) / G0;
      const anal = spaghettificationAnalysis(m, { bodyLengthM: L, limitG: 10 });
      return {
        title: 'Astronot Üzerindeki Radyal Gelgit İvmesi',
        story: `Boyu $L = 2\\,\\text{m}$ olan bir astronot, kütlesi $M = ${isStellar ? mSol : fmtLatexSci(mSol, 2)}\\,M_\\odot$ olan bir Schwarzschild kara deliğinden $r = ${rFactor}\\,r_s$ uzaklıkta radyal olarak düşüyor.`,
        parts: makeLabels([
          {
            prompt: `Astronotun başı ile ayakları arasındaki gelgit ivmesi $\\Delta a = 2GML/r^3$ kaç **$g_0$** ($g_0 = 9,807\\,\\text{m/s}^2$) olur?`,
            kind: 'answer',
            answer: numSpec(daG, 0.02),
            hints: [
              'Önce $r_s = 2GM/c^2$ ve $r = ' + rFactor + '\\,r_s$ değerlerini metre cinsinden hesaplayın.',
              '$\\Delta a = \\frac{2GML}{r^3}$ değerini $g_0 = 9,80665\\,\\text{m/s}^2$\'ye bölün.',
            ],
            solution: [
              `$r_s = ${fmtLatexSci(rs, 3)}\\,\\text{m}$, $r = ${fmtLatexSci(r, 3)}\\,\\text{m}$.`,
              `$\\Delta a = \\frac{2GML}{r^3} = ${fmtLatexSci(daG * G0, 3)}\\,\\text{m/s}^2 \\approx ${roundSig(daG, 4)}\\,g_0$.`,
            ],
          },
          {
            prompt: `Bu kara delikte $10\\,g_0$ spagettileşme sınırına olay ufkunun **dışında** mı ulaşılır?`,
            kind: 'answer',
            answer: { type: 'yesno', value: anal.outsideHorizon },
            hints: [
              'Ufuktaki gelgit ivmesi $\\Delta a(r_s) \\propto M^{-2}$ ile azalır; eşik kütle yaklaşık $1,45\\times 10^4\\,M_\\odot$\'tür.',
            ],
            solution: [
              `Ufuktaki gelgit ivmesi $${fmtLatexSci(anal.horizonTidalG, 2)}\\,g_0$ olup $10\\,g_0$ sınırından ${anal.outsideHorizon ? 'büyüktür (ufuk dışında spagettileşme): **Evet**' : 'küçüktür (ufku sağlam geçer): **Hayır**'}.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mSol = rng.pick([5, 10, 15, 25, 50]);
      const limG = rng.pick([10, 15, 20]);
      const L = 2;
      const m = solarMassToKg(mSol);
      const rTidalKm = mToKm(tidalRadius(m, limG * G0, L));
      const rsKm = mToKm(schwarzschildRadius(m));
      return {
        title: 'Spagettileşme Yarıçapı ve Olay Ufku Karşılaştırması',
        story: `Boyu $L = 2\\,\\text{m}$ olan bir astronot, kütlesi $M = ${mSol}\\,M_\\odot$ olan bir yıldızsal kara deliğe düşüyor. Dayanım sınırı $\\Delta a_{\\text{maks}} = ${limG}\\,g_0$ olarak alınıyor.`,
        parts: makeLabels([
          {
            prompt: `Spagettileşme yarıçapı $r_{\\text{gelgit}} = (2GML/\\Delta a_{\\text{maks}})^{1/3}$ kaç **kilometre** ($\\text{km}$) olur?`,
            kind: 'answer',
            answer: numSpec(rTidalKm, 0.015),
            hints: [
              '$\\Delta a_{\\text{maks}} = ' + limG + ' \\times 9,80665\\,\\text{m/s}^2$.',
              'Küp kökü metre cinsinden alıp $10^3$\'e bölün.',
            ],
            solution: [
              `$r_{\\text{gelgit}} = \\left(\\frac{2GM \\times 2}{${limG} g_0}\\right)^{1/3} \\approx ${roundSig(rTidalKm, 4)}\\,\\text{km}$.`,
            ],
          },
          {
            prompt: `Bu spagettileşme yarıçapı, olay ufku yarıçapı $r_s$\'nin kaç katıdır ($r_{\\text{gelgit}}/r_s$)?`,
            kind: 'answer',
            answer: numSpec(rTidalKm / rsKm, 0.015),
            hints: [
              `$r_s \\approx ${roundSig(rsKm, 4)}\\,\\text{km}$ değerine bölün.`,
            ],
            solution: [
              `$\\frac{r_{\\text{gelgit}}}{r_s} = \\frac{${roundSig(rTidalKm, 4)}}{${roundSig(rsKm, 4)}} \\approx ${roundSig(rTidalKm / rsKm, 4)}$ (astronot ufka çok uzaktayken parçalanır).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: ufku sağlam geçmek için eşik kütle
    const L = rng.pick([1.8, 2.0, 2.5, 4.0]);
    const limG = rng.pick([5, 10, 20, 50]);
    const mCritKg = spaghettificationMassThreshold(limG * G0, L);
    const mCritSol = kgToSolarMass(mCritKg);
    return {
      title: 'Olay Ufkunu Sağlam Geçme Kütle Eşiği',
      story: `Uzunluğu $L = ${L}\\,\\text{m}$ olan bir uzay sondasının, olay ufkundan ($r = r_s$) geçerken $\\Delta a_{\\text{maks}} = ${limG}\\,g_0$ gelgit ivmesini aşmadan sağlam kalmasını istiyoruz.`,
      parts: makeLabels([
        {
          prompt: `Bunu sağlayan en küçük Schwarzschild kara delik kütlesi $M_{\\text{eşik}}$ kaç **Güneş kütlesi** ($M_\\odot$) olmalıdır?`,
          kind: 'answer',
          answer: numSpec(mCritSol, 0.02),
          hints: [
            'Ufukta $\\Delta a(r_s) = \\frac{2GML}{(2GM/c^2)^3} = \\frac{c^6 L}{4 G^2 M^2}$.',
            '$\\Delta a(r_s) = \\Delta a_{\\text{maks}}$ eşitliğini $M$ için çözün: $M_{\\text{eşik}} = \\frac{c^3}{2G}\\sqrt{\\frac{L}{\\Delta a_{\\text{maks}}}}$.',
          ],
          solution: [
            `$M_{\\text{eşik}} = \\frac{c^3}{2G}\\sqrt{\\frac{${L}}{${limG}\\times 9,80665}} = ${fmtLatexSci(mCritKg, 3)}\\,\\text{kg}$.`,
            `Güneş kütlesi cinsinden: $M_{\\text{eşik}} \\approx ${roundSig(mCritSol, 4)}\\,M_\\odot$.`,
          ],
        },
      ]),
    };
  },
};

// 9. Hawking sıcaklığı ve buharlaşma
const T_HAWKING = {
  id: 'bh-hawking-sicaklik',
  topic: 'Gelgit ve Termodinamik',
  title: 'Hawking Sıcaklığı, Entropi ve Buharlaşma Süresi',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mSol = rng.pick([1, 2, 5, 10, 20]);
      const m = solarMassToKg(mSol);
      const tNk = hawkingTemperature(m) * 1e9; // nanokelvin
      return {
        title: 'Yıldızsal Kara Deliğin Hawking Sıcaklığı',
        story: `Kuantum alan teorisine göre kütlesi $M = ${mSol}\\,M_\\odot$ olan bir Schwarzschild kara deliği $T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}$ sıcaklığında kara cisim ışıması yapar.`,
        parts: makeLabels([
          {
            prompt: `Bu kara deliğin Hawking sıcaklığı $T_H$ kaç **nanokelvin** ($\\text{nK} = 10^{-9}\\,\\text{K}$) olur?`,
            kind: 'answer',
            answer: numSpec(tNk, 0.015),
            hints: [
              '$1\\,M_\\odot$ için $T_H \\approx 61,70\\,\\text{nK}$ ($6,17\\times 10^{-8}\\,\\text{K}$).',
              '$T_H \\propto 1/M$ olduğundan $61,70\\,\\text{nK}$ değerini $M/M_\\odot$ ile bölün.',
            ],
            solution: [
              `$T_H = \\frac{\\hbar c^3}{8\\pi G M k_B} = \\frac{61,70\\,\\text{nK}}{${mSol}} \\approx ${roundSig(tNk, 4)}\\,\\text{nK}$.`,
            ],
          },
          {
            prompt: `Kozmik mikrodalga artalan sıcaklığı $T_{\\text{CMB}} = 2,725\\,\\text{K}$ olduğuna göre, bu kara delik bugün net olarak **kütle kaybedip buharlaşır** mı?`,
            kind: 'answer',
            answer: { type: 'yesno', value: false },
            hints: [
              '$T_H \\ll T_{\\text{CMB}}$ olduğundan kara delik çevresinden soğurduğu enerjiden çok daha azını yayar.',
            ],
            solution: [
              `$T_H \\approx ${roundSig(tNk, 3)}\\,\\text{nK} \\ll 2,725\\,\\text{K}$ olduğu için kara delik net enerji soğurur ve büyür: **Hayır**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mSol = rng.pick([1, 2, 3, 5, 10]);
      const m = solarMassToKg(mSol);
      const tYr = secToYears(hawkingEvaporationTime(m));
      const tScaled = tYr / 1e67;
      const lamKm = mToKm(hawkingPeakWavelength(m));
      return {
        title: 'Buharlaşma Süresi ve Hawking Tepe Dalga Boyu',
        story: `Kütlesi $M = ${mSol}\\,M_\\odot$ olan yalıtılmış (dış ışıma almayan) bir Schwarzschild kara deliğini kara cisim yaklaşımında inceliyoruz.`,
        parts: makeLabels([
          {
            prompt: `Kara deliğin tamamen buharlaşma süresi $t_{\\text{buh}} = \\frac{5120\\pi G^2 M^3}{\\hbar c^4}$ kaç **$10^{67}$ yıl** olur?`,
            kind: 'answer',
            answer: numSpec(tScaled, 0.02),
            hints: [
              '$1\\,M_\\odot$ için $t_{\\text{buh}} \\approx 2,096\\times 10^{67}\\,\\text{yıl}$.',
              '$t_{\\text{buh}} \\propto M^3$ olduğundan $(M/M_\\odot)^3$ ile çarpın.',
            ],
            solution: [
              `$t_{\\text{buh}} = 2,096\\times 10^{67} \\times ${mSol}^3\\,\\text{yıl} \\approx ${roundSig(tScaled, 4)}\\times 10^{67}\\,\\text{yıl}$.`,
            ],
          },
          {
            prompt: `Hawking ışımasının Wien tepe dalga boyu $\\lambda_{\\text{tepe}} = b / T_H$ kaç **kilometre** ($\\text{km}$) olur?`,
            kind: 'answer',
            answer: numSpec(lamKm, 0.02),
            hints: [
              '$b = 2,8978\\times 10^{-3}\\,\\text{m}\\cdot\\text{K}$ ve $T_H = \\frac{6,170\\times 10^{-8}}{M/M_\\odot}\\,\\text{K}$.',
              'Ayrıca evrensel olarak $\\lambda_{\\text{tepe}} \\approx 15,90\\,r_s$ geçerlidir.',
            ],
            solution: [
              `$\\lambda_{\\text{tepe}} = \\frac{b}{T_H} \\approx 15,902\\,r_s \\approx ${roundSig(lamKm, 4)}\\,\\text{km}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: ilkel kara delik kütlesi, sıcaklığı ve entropisi
    const tGyr = rng.pick([1, 5, 13.787, 30]);
    const tSec = yearsToSec(tGyr * 1e9);
    const mKg = evaporationMassForTime(tSec);
    const mIn1e11 = mKg / 1e11;
    const Th1e11 = hawkingTemperature(mKg) / 1e11;
    return {
      title: 'İlkel Kara Deliklerin Buharlaşma Eşiği',
      story: `Erken evrende oluşmuş bir ilkel (primordial) kara deliğin tam $t = ${tGyr}\\,\\text{milyar yıl}$ ($${tGyr}\\times 10^9\\,\\text{yıl}$) içinde Hawking ışımasıyla buharlaştığını varsayalım.`,
      parts: makeLabels([
        {
          prompt: `Bu kara deliğin başlangıç kütlesi kaç **$10^{11}\\,\\text{kg}$** olmalıdır?`,
          kind: 'answer',
          answer: numSpec(mIn1e11, 0.02),
          hints: [
            '$t = \\frac{5120\\pi G^2 M^3}{\\hbar c^4}$ denkleminden $M = \\left(\\frac{\\hbar c^4 t}{5120\\pi G^2}\\right)^{1/3}$ çekin.',
            'Evrenin yaşı ($13,787\\,\\text{Gyr}$) için $M \\approx 1,73\\times 10^{11}\\,\\text{kg}$ bulunur.',
          ],
          solution: [
            `$t = ${fmtLatexSci(tSec, 3)}\\,\\text{s} \\implies M = \\left(\\frac{\\hbar c^4 t}{5120\\pi G^2}\\right)^{1/3} \\approx ${roundSig(mIn1e11, 4)}\\times 10^{11}\\,\\text{kg}$.`,
          ],
        },
        {
          prompt: `Bu başlangıç kütlesindeki Hawking sıcaklığı $T_H$ kaç **$10^{11}\\,\\text{K}$** olur?`,
          kind: 'answer',
          answer: numSpec(Th1e11, 0.02),
          hints: [
            '$T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}$ değerini bulduğunuz $M$ ile hesaplayıp $10^{11}$\'e bölün.',
          ],
          solution: [
            `$T_H = \\frac{\\hbar c^3}{8\\pi G M k_B} \\approx ${roundSig(Th1e11, 4)}\\times 10^{11}\\,\\text{K}$ (gama ışını enerjisinde!).`,
          ],
        },
      ]),
    };
  },
};

// 10. Eddington parlaklığı ve yığılma
const T_EDDINGTON = {
  id: 'bh-eddington-yigilma',
  topic: 'Yığılma Diskleri',
  title: 'Eddington Parlaklığı ve Kütle Yığılma Hızı',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mSol = rng.pick([5, 10, 20, 50, 100]);
      const m = solarMassToKg(mSol);
      const lEdd31 = eddingtonLuminosity(m) / 1e31;
      return {
        title: 'Eddington Parlaklık Sınırı',
        story: `Kütlesi $M = ${mSol}\\,M_\\odot$ olan bir kara deliğe küresel simetrik olarak saf iyonize hidrojen gazı akıyor.`,
        parts: makeLabels([
          {
            prompt: `Bu kara deliğin Eddington parlaklığı $L_{\\text{Edd}} = \\frac{4\\pi G M m_p c}{\\sigma_T}$ kaç **$10^{31}\\,\\text{W}$** olur?`,
            kind: 'answer',
            answer: numSpec(lEdd31, 0.015),
            hints: [
              '$1\\,M_\\odot$ için $L_{\\text{Edd}} \\approx 1,257\\times 10^{31}\\,\\text{W}$.',
              'Kütleyle doğrusal olarak $M/M_\\odot$ ile çarpın.',
            ],
            solution: [
              `$L_{\\text{Edd}} = ${mSol} \\times 1,257\\times 10^{31}\\,\\text{W} \\approx ${roundSig(lEdd31, 4)}\\times 10^{31}\\,\\text{W}$.`,
            ],
          },
          {
            prompt: `Eddington sınırında içeri çeken kütleçekim kuvvetini hangi fiziksel mekanizma dengeler?`,
            kind: 'answer',
            answer: choiceSpec(
              rng,
              'Yığılma ışınımının serbest elektronlardan Thomson saçılmasıyla oluşturduğu ışınım basıncı',
              [
                'Hawking ışımasının olay ufkundan uyguladığı kuantum basıncı',
                'Merkezkaç kuvvetinin protonların kütlesini sıfırlaması',
                'Kerr çerçeve sürüklenmesinin gazı dışarı itmesi',
              ],
            ),
            hints: [
              'Formülde proton kütlesi $m_p$ ile Thomson tesir kesiti $\\sigma_T$ birlikte yer alır.',
            ],
            solution: [
              'Kütleçekim esas olarak protonlara etkirken ışınım basıncı serbest elektronlardan Thomson saçılması ($\\sigma_T$) yoluyla aktarılır ve elektrostatik çekim elektron-proton çiftini birlikte tutar.',
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mExp = rng.pick([6, 7, 8, 9]);
      const coef = rng.pick([1, 2, 4, 5]);
      const mSol = coef * Math.pow(10, mExp);
      const eta = rng.pick([0.057, 0.1, 0.2, 0.3]);
      const m = solarMassToKg(mSol);
      const mdotKgS = eddingtonAccretionRate(m, eta);
      const mdotSolYr = (mdotKgS * YEAR) / M_SUN;
      return {
        title: 'Kuasar Beslenmesi: Eddington Yığılma Hızı',
        story: `Kütlesi $M = ${coef}\\times 10^{${mExp}}\\,M_\\odot$ olan bir aktif galaksi çekirdeğinde ince diskin ışınım verimi $\\eta = ${eta}$ olarak ölçülüyor.`,
        parts: makeLabels([
          {
            prompt: `Eddington parlaklığına ulaşmak için gereken kütle yığılma hızı $\\dot{M}_{\\text{Edd}} = L_{\\text{Edd}}/(\\eta c^2)$ kaç **$M_\\odot / \\text{yıl}$** olur?`,
            kind: 'answer',
            answer: numSpec(mdotSolYr, 0.02),
            hints: [
              'Önce $L_{\\text{Edd}} = 1,257\\times 10^{31}\\,(M/M_\\odot)\\,\\text{W}$ değerini bulun.',
              '$\\dot{M}_{\\text{Edd}} = L_{\\text{Edd}} / (\\eta c^2)$ (kg/s) değerini $M_\\odot / \\text{yıl}$ birimine çevirmek için $\\text{yıl}/M_\\odot$ ile çarpın.',
            ],
            solution: [
              `$L_{\\text{Edd}} = ${fmtLatexSci(eddingtonLuminosity(m), 3)}\\,\\text{W}$, $\\dot{M}_{\\text{Edd}} = ${fmtLatexSci(mdotKgS, 3)}\\,\\text{kg/s}$.`,
              `$M_\\odot/\\text{yıl}$ cinsinden: $\\dot{M}_{\\text{Edd}} \\approx ${roundSig(mdotSolYr, 4)}\\,M_\\odot/\\text{yıl}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: kuasar parlaklığından minimum kütle + gerçek yığılma hızı
    const lPow = rng.pick([39, 40]);
    const lCoef = rng.pick([1.5, 2.5, 4.0, 6.0]);
    const Lbol = lCoef * Math.pow(10, lPow);
    const fEdd = rng.pick([0.2, 0.25, 0.5, 1.0]);
    const eta = 0.1;
    const mMinKg = (Lbol / fEdd) * (SIGMA_T / (4 * Math.PI * G * M_PROTON * C));
    const mMin1e8 = kgToSolarMass(mMinKg) / 1e8;
    const mdotSolYr = ((Lbol / (eta * C2)) * YEAR) / M_SUN;
    return {
      title: 'Kuasar Parlaklığından Kara Delik Kütlesi ve Yakıt Tüketimi',
      story: `Uzak bir kuasarın bolometrik parlaklığı $L = ${lCoef}\\times 10^{${lPow}}\\,\\text{W}$ olarak ölçülüyor. Kuasarın Eddington sınırının $f_{\\text{Edd}} = ${fEdd}$ katında ve $\\eta = 0,10$ ışınım verimiyle çalıştığı modelleniyor.`,
      parts: makeLabels([
        {
          prompt: `Merkezdeki kara deliğin kütlesi kaç **$10^8\\,M_\\odot$** olmalıdır?`,
          kind: 'answer',
          answer: numSpec(mMin1e8, 0.02),
          hints: [
            '$L = f_{\\text{Edd}} L_{\\text{Edd}}(M) \\implies L_{\\text{Edd}} = L / f_{\\text{Edd}}$.',
            '$M / M_\\odot = L_{\\text{Edd}} / (1,257\\times 10^{31}\\,\\text{W})$.',
          ],
          solution: [
            `$L_{\\text{Edd}} = ${fmtLatexSci(Lbol / fEdd, 3)}\\,\\text{W} \\implies M \\approx ${roundSig(mMin1e8, 4)}\\times 10^8\\,M_\\odot$.`,
          ],
        },
        {
          prompt: `Bu parlaklığı $\\eta = 0,10$ verimle beslemek için kara deliğe yılda kaç **Güneş kütlesi** ($M_\\odot/\\text{yıl}$) madde akmalıdır?`,
          kind: 'answer',
          answer: numSpec(mdotSolYr, 0.02),
          hints: [
            '$L = \\eta \\dot{M} c^2 \\implies \\dot{M} = \\frac{L}{\\eta c^2}$.',
          ],
          solution: [
            `$\\dot{M} = \\frac{${lCoef}\\times 10^{${lPow}}}{0,10 \\times c^2} = ${fmtLatexSci(Lbol / (eta * C2), 3)}\\,\\text{kg/s} \\approx ${roundSig(mdotSolYr, 4)}\\,M_\\odot/\\text{yıl}$.`,
          ],
        },
      ]),
    };
  },
};

// 11. Shakura-Sunyaev ince disk sıcaklık profili
const T_DISK_TEMP = {
  id: 'bh-disk-sicaklik',
  topic: 'Yığılma Diskleri',
  title: 'Shakura-Sunyaev İnce Disk Sıcaklık Profili',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mSol = rng.pick([10, 15, 20, 30]);
      const m = solarMassToKg(mSol);
      const rInKm = mToKm(schwarzschildIsco(m));
      const rPeakKm = (49 / 36) * rInKm;
      return {
        title: 'İnce Diskte Azami Sıcaklık Konumu ve Tayf Bölgesi',
        story: `Shakura-Sunyaev ince yığılma diskinde sıcaklık $T(r) \\propto r^{-3/4}(1 - \\sqrt{r_{\\text{in}}/r})^{1/4}$ profiline uyar ve iç sınır $r_{\\text{in}} = r_{\\text{ISCO}}$\'da sıfırlanır. Kütlesi $M = ${mSol}\\,M_\\odot$ olan dönmeyen bir kara deliği inceleyin.`,
        parts: makeLabels([
          {
            prompt: `Disk sıcaklığının maksimuma ulaştığı yarıçap $r_{\\text{tepe}} = \\frac{49}{36}\\,r_{\\text{ISCO}}$ kaç **kilometre** ($\\text{km}$) olur?`,
            kind: 'answer',
            answer: numSpec(rPeakKm, 0.015),
            hints: [
              'Önce $r_{\\text{ISCO}} = 6GM/c^2$ değerini kilometre cinsinden hesaplayın.',
              '$49/36 \\approx 1,3611$ ile çarpın.',
            ],
            solution: [
              `$r_{\\text{ISCO}} \\approx ${roundSig(rInKm, 4)}\\,\\text{km} \\implies r_{\\text{tepe}} = \\frac{49}{36} r_{\\text{ISCO}} \\approx ${roundSig(rPeakKm, 4)}\\,\\text{km}$.`,
            ],
          },
          {
            prompt: `Aynı Eddington oranında ($f_{\\text{Edd}}$) beslenen bir **yıldızsal** ($10\\,M_\\odot$) ve bir **süperkütleli** ($10^8\\,M_\\odot$) kara deliğin diskleri hangi dalga boylarında tepe yapar?`,
            kind: 'answer',
            answer: choiceSpec(
              rng,
              'Yıldızsal kara delik X-ışınlarında, süperkütleli kara delik daha soğuk olduğundan morötesi (UV)/görünür bölgede tepe yapar',
              [
                'Süperkütleli kara delik daha ağır olduğu için çok daha sıcaktır ve gama ışınlarında tepe yapar',
                'İkisinin de tepe sıcaklığı kütleden bağımsızdır ve aynı dalga boyunda parlar',
                'Yıldızsal kara delik radyo dalgalarında, süperkütleli kara delik X-ışınlarında tepe yapar',
              ],
            ),
            hints: [
              'Sabit Eddington oranında $T_{\\text{maks}} \\propto M^{-1/4}$ ölçeklenir: daha büyük kütle, daha serin disk!',
            ],
            solution: [
              '$\\dot{M} \\propto M$ ve $r_{\\text{in}} \\propto M$ olduğundan $T_{\\text{maks}} \\propto (M \\dot{M} / r_{\\text{in}}^3)^{1/4} \\propto M^{-1/4}$. Bu yüzden yıldızsal diskler $\\sim 10^7\\,\\text{K}$ (X-ışını), süperkütleli diskler $\\sim 10^4\\text{–}10^5\\,\\text{K}$ (UV/görünür) sıcaklıktadır.',
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const mSol = rng.pick([10, 15, 20]);
      const fEdd = rng.pick([0.1, 0.2, 0.5]);
      const m = solarMassToKg(mSol);
      const eta = kerrRadiativeEfficiency(0);
      const mdot = fEdd * eddingtonAccretionRate(m, eta);
      const dmax = diskTemperatureMax(m, mdot, schwarzschildIsco(m));
      const tMK = dmax.Tmax / 1e6;
      const lamNm = dmax.peakWavelengthM * 1e9;
      return {
        title: 'Yıldızsal Kara Delik Diskinin Tepe Sıcaklığı',
        story: `Kütlesi $M = ${mSol}\\,M_\\odot$ olan bir Schwarzschild kara deliği, $\\eta = 1 - \\sqrt{8/9} \\approx 0,0572$ verimiyle $f_{\\text{Edd}} = ${fEdd}$ Eddington oranında ($\\dot{M} = ${fmtLatexSci(mdot, 3)}\\,\\text{kg/s}$) madde yığıyor.`,
        parts: makeLabels([
          {
            prompt: `Shakura-Sunyaev ince diskinin azami sıcaklığı $T_{\\text{maks}}$ kaç **milyon kelvin** ($10^6\\,\\text{K}$) olur?`,
            kind: 'answer',
            answer: numSpec(tMK, 0.02),
            hints: [
              '$r_{\\text{in}} = 6GM/c^2$ ve $r_{\\text{tepe}} = (49/36)\\,r_{\\text{in}}$.',
              '$T(r_{\\text{tepe}}) = \\left[\\frac{3GM\\dot{M}}{8\\pi\\sigma_{\\text{SB}} r_{\\text{tepe}}^3}\\left(1 - \\frac{6}{7}\\right)\\right]^{1/4}$.',
            ],
            solution: [
              `$r_{\\text{tepe}} = \\frac{49}{36} r_{\\text{ISCO}} = ${fmtLatexSci(dmax.rPeak, 3)}\\,\\text{m}$.`,
              `$T_{\\text{maks}} \\approx ${roundSig(tMK, 4)}\\times 10^6\\,\\text{K}$.`,
            ],
          },
          {
            prompt: `Bu azami sıcaklığın Wien tepe dalga boyu $\\lambda_{\\text{tepe}} = b / T_{\\text{maks}}$ kaç **nanometre** ($\\text{nm}$) olur?`,
            kind: 'answer',
            answer: numSpec(lamNm, 0.02),
            hints: [
              '$b = 2,8978\\times 10^{-3}\\,\\text{m}\\cdot\\text{K}$; sonucu $10^9$ ile çarpıp nm yapın.',
            ],
            solution: [
              `$\\lambda_{\\text{tepe}} = \\frac{2,8978\\times 10^{-3}}{${fmtLatexSci(dmax.Tmax, 3)}} \\approx ${roundSig(lamNm, 4)}\\,\\text{nm}$ (${dmax.band} bölgesi).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: kütle ölçekleme T_max ~ M^(-1/4) ve iki yarıçap oranı
    const m1Sol = rng.pick([10, 16]);
    const ratioExp = rng.pick([4, 8]); // M2 / M1 = 10^4 veya 10^8 -> 4. kök temiz!
    const m2Sol = m1Sol * Math.pow(10, ratioExp);
    const tempRatio = Math.pow(m2Sol / m1Sol, 0.25); // T1 / T2 = (M2/M1)^(1/4)
    const x1 = 2; // r1 = 2 r_in
    const x2 = rng.pick([8, 16, 25]);
    const tRatioR = Math.pow((Math.pow(x2, 3) * (1 - 1 / Math.sqrt(x1))) / (Math.pow(x1, 3) * (1 - 1 / Math.sqrt(x2))), 0.25);
    return {
      title: 'Disk Sıcaklığında Kütle ve Yarıçap Ölçeklemesi',
      story: `Aynı Eddington oranında ($f_{\\text{Edd}}$) ve aynı ışınım veriminde çalışan iki Schwarzschild kara deliğini karşılaştırıyoruz: $M_1 = ${m1Sol}\\,M_\\odot$ ve $M_2 = ${m1Sol}\\times 10^{${ratioExp}}\\,M_\\odot$.`,
      parts: makeLabels([
        {
          prompt: `Yıldızsal kara deliğin azami disk sıcaklığı, dev kara deliğin azami sıcaklığının kaç katıdır ($T_{\\text{maks},1} / T_{\\text{maks},2}$)?`,
          kind: 'answer',
          answer: numSpec(tempRatio, 0.01),
          hints: [
            '$T_{\\text{maks}} \\propto M^{-1/4}$ bağıntısını kullanın.',
            `$(M_2 / M_1)^{1/4} = (10^{${ratioExp}})^{1/4}$.`,
          ],
          solution: [
            `$\\frac{T_{\\text{maks},1}}{T_{\\text{maks},2}} = \\left(\\frac{M_2}{M_1}\\right)^{1/4} = 10^{${ratioExp / 4}} = ${roundSig(tempRatio, 4)}$.`,
          ],
        },
        {
          prompt: `Aynı diskte $r_1 = ${x1}\\,r_{\\text{in}}$ noktasındaki sıcaklığın $r_2 = ${x2}\\,r_{\\text{in}}$ noktasındaki sıcaklığa oranı $T(r_1) / T(r_2)$ kaçtır?`,
          kind: 'answer',
          answer: numSpec(tRatioR, 0.015),
          hints: [
            '$\\frac{T(r_1)}{T(r_2)} = \\left(\\frac{r_2}{r_1}\\right)^{3/4}\\left(\\frac{1 - \\sqrt{r_{\\text{in}}/r_1}}{1 - \\sqrt{r_{\\text{in}}/r_2}}\\right)^{1/4}$.',
          ],
          solution: [
            `$\\frac{T(${x1} r_{\\text{in}})}{T(${x2} r_{\\text{in}})} = (${x2 / x1})^{3/4} \\left(\\frac{1 - 1/\\sqrt{${x1}}}{1 - 1/\\sqrt{${x2}}}\\right)^{1/4} \\approx ${roundSig(tRatioR, 4)}$.`,
          ],
        },
      ]),
    };
  },
};

// 12. Kerr ufuklar, ergosfer ve dönme enerjisi
const T_KERR_HORIZON = {
  id: 'bh-kerr-ufuk-ergosfer',
  topic: 'Kerr Kara Delikleri',
  title: 'Kerr Kara Deliği: Ufuklar, Ergosfer ve Dönme Enerjisi',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const aStar = rng.pick([0.6, 0.8, 0.9, 0.96, 0.998]);
      const { rPlus, rMinus } = kerrHorizonsGeom(aStar);
      const ergoThick = 2 - rPlus;
      return {
        title: 'Kerr Olay Ufukları ve Ergosfer Kalınlığı',
        story: `Boyutsuz dönme parametresi $a_* = a/M = ${aStar}$ olan bir Kerr kara deliğini geometrik birimlerde ($G = c = 1$, yarıçaplar $M$ biriminde) inceliyoruz.`,
        parts: makeLabels([
          {
            prompt: `Dış olay ufku yarıçapı $r_+ / M = 1 + \\sqrt{1 - a_*^2}$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(rPlus, 0.01),
            hints: [
              `$r_+/M = 1 + \\sqrt{1 - ${aStar}^2}$.`,
            ],
            solution: [
              `$r_+/M = 1 + \\sqrt{1 - ${roundSig(aStar * aStar, 4)}} \\approx ${roundSig(rPlus, 4)}$.`,
            ],
          },
          {
            prompt: `Ekvatorda ergosferin dış sınırı $r_{\\text{ergo}} = 2M$ olduğuna göre, ekvatoryal ergosfer kalınlığı $(r_{\\text{ergo}} - r_+)/M$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(ergoThick, 0.015),
            hints: [
              '$2 - r_+/M = 1 - \\sqrt{1 - a_*^2} = r_-/M$.',
            ],
            solution: [
              `$\\frac{r_{\\text{ergo}} - r_+}{M} = 2 - ${roundSig(rPlus, 4)} \\approx ${roundSig(ergoThick, 4)}$ (ekvatorda $r_-$ değerine eşittir).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const aStar = rng.pick([0.6, 0.8, 0.9, 0.95]);
      const mSol = rng.pick([10, 20, 50]);
      const m = solarMassToKg(mSol);
      const omegaH = kerrHorizonOmega(m, aStar);
      const irr = kerrIrreducibleMass(m, aStar);
      const irrFrac = irr.irreducibleMassKg / m;
      return {
        title: 'Ufuk Açısal Hızı ve İndirgenemez Kütle',
        story: `Kütlesi $M = ${mSol}\\,M_\\odot$ ve boyutsuzluk spini $a_* = ${aStar}$ olan bir Kerr kara deliği uzay-zamanı kendi etrafında sürüklüyor.`,
        parts: makeLabels([
          {
            prompt: `Olay ufkunun açısal hızı $\\Omega_H = \\frac{a_* c^3}{2GM(1 + \\sqrt{1 - a_*^2})}$ kaç **$\\text{rad/s}$** olur?`,
            kind: 'answer',
            answer: numSpec(omegaH, 0.02),
            hints: [
              'Önce geometrik $\\Omega_{H,\\text{geom}} = \\frac{a_*}{2(1+\\sqrt{1-a_*^2})}$ değerini bulun.',
              '$t_g = GM/c^3 = 4,9255\\times 10^{-6}\\,(M/M_\\odot)\\,\\text{s}$ değerine bölün.',
            ],
            solution: [
              `$\\Omega_{H,\\text{geom}} \\approx ${roundSig(kerrHorizonOmegaGeom(aStar), 4)}\\,M^{-1}$, $t_g = ${fmtLatexSci(gravTime(m), 3)}\\,\\text{s}$.`,
              `$\\Omega_H = \\Omega_{H,\\text{geom}} / t_g \\approx ${roundSig(omegaH, 4)}\\,\\text{rad/s}$.`,
            ],
          },
          {
            prompt: `Kara deliğin indirgenemez kütle oranı $M_{\\text{irr}} / M = \\sqrt{\\frac{1 + \\sqrt{1 - a_*^2}}{2}}$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(irrFrac, 0.01),
            hints: [
              'Christodoulou-Ruffini formülü: $M_{\\text{irr}}/M = \\sqrt{r_+ / (2M)}$.',
            ],
            solution: [
              `$\\frac{M_{\\text{irr}}}{M} = \\sqrt{\\frac{1 + \\sqrt{1 - ${aStar}^2}}{2}} \\approx ${roundSig(irrFrac, 4)}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: Penrose süreci çıkarılabilir dönme enerjisi
    const aStar = rng.pick([0.7, 0.85, 0.95, 0.998]);
    const mSol = rng.pick([10, 20, 62, 100]);
    const m = solarMassToKg(mSol);
    const irr = kerrIrreducibleMass(m, aStar);
    const pct = irr.extractableFraction * 100;
    const extSol = kgToSolarMass(irr.extractableMassKg);
    return {
      title: 'Penrose Süreci: Çıkarılabilir Dönme Enerjisi',
      story: `Kütlesi $M = ${mSol}\\,M_\\odot$ ve spini $a_* = ${aStar}$ olan bir Kerr kara deliğinin ergosferinden (Penrose veya Blandford-Znajek mekanizmasıyla) kuramsal olarak en fazla $(M - M_{\\text{irr}})c^2$ kadar dönme enerjisi çıkarılabilir.`,
      parts: makeLabels([
        {
          prompt: `Toplam kütle-enerjinin yüzde kaçı (**%**) dönme enerjisi olarak çıkarılabilir?`,
          kind: 'answer',
          answer: numSpec(pct, 0.015),
          hints: [
            '$\\frac{E_{\\text{dön}}}{Mc^2} = 1 - \\sqrt{\\frac{1 + \\sqrt{1 - a_*^2}}{2}}$.',
            'Yüzdeye çevirmek için $100$ ile çarpın (azami sınır $a_* = 1$ için $1 - 1/\\sqrt{2} \\approx \\%29,29$).',
          ],
          solution: [
            `$1 - \\sqrt{\\frac{1 + \\sqrt{1 - ${aStar}^2}}{2}} \\approx ${roundSig(irr.extractableFraction, 4)} = \\%${roundSig(pct, 4)}$.`,
          ],
        },
        {
          prompt: `Bu çıkarılabilir enerji kaç **$M_\\odot c^2$** değerine karşılık gelir?`,
          kind: 'answer',
          answer: numSpec(extSol, 0.015),
          hints: [
            'Bulduğunuz kesri $M = ' + mSol + '\\,M_\\odot$ ile çarpın.',
          ],
          solution: [
            `$E_{\\text{dön}} / c^2 = ${mSol} \\times ${roundSig(irr.extractableFraction, 4)} \\approx ${roundSig(extSol, 4)}\\,M_\\odot$.`,
          ],
        },
      ]),
    };
  },
};

// 13. Kerr ISCO ve ışınım verimi
const T_KERR_ISCO = {
  id: 'bh-kerr-isco-verim',
  topic: 'Kerr Kara Delikleri',
  title: 'Kerr ISCO Yarıçapı ve İnce Disk Işınım Verimi',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const aStar = rng.pick([0.5, 0.7, 0.9, 0.998]);
      const rPro = kerrIscoGeom(aStar, true);
      const rRet = kerrIscoGeom(aStar, false);
      return {
        title: 'Eşyönlü ve Ters Yönlü Kerr Yörüngeleri',
        story: `Boyutsuz spini $a_* = ${aStar}$ olan bir Kerr kara deliği çevresinde eşyönlü (prograde) ve ters yönlü (retrograde) yığılma disklerini karşılaştırıyoruz.`,
        parts: makeLabels([
          {
            prompt: `Çerçeve sürüklenmesi nedeniyle hangi yönde dönen disk kara deliğe **daha yakın** kararlı yörüngelere (daha küçük $r_{\\text{ISCO}}$) sahip olur?`,
            kind: 'answer',
            answer: choiceSpec(
              rng,
              'Kara delikle aynı yönde dönen (eşyönlü / prograde) disk',
              [
                'Kara deliğe ters yönde dönen (retrograde) disk',
                'ISCO yarıçapı yalnızca kütleye bağlıdır, her iki yön de $6M$ olur',
                'Dönen kara deliklerde kararlı dairesel yörünge yoktur',
              ],
            ),
            hints: [
              'Çerçeve sürüklenmesi aynı yöndeki parçacığa ekstra destek sağlar; ters yöndeki parçacığı ise daha büyük yarıçapa iter.',
            ],
            solution: [
              `$a_* = ${aStar}$ için eşyönlü ISCO $${roundSig(rPro, 4)}\\,M$, ters yönlü ISCO $${roundSig(rRet, 4)}\\,M$ olur; yani **eşyönlü** disk çok daha yakına sokulabilir.`,
            ],
          },
          {
            prompt: `Bardeen-Press-Teukolsky formülüne göre $a_* = ${aStar}$ için **eşyönlü** ISCO yarıçapı $r_{\\text{ISCO}} / M$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(rPro, 0.02),
            hints: [
              '$Z_1 = 1 + (1 - a_*^2)^{1/3}[(1+a_*)^{1/3} + (1-a_*)^{1/3}]$, $Z_2 = \\sqrt{3a_*^2 + Z_1^2}$.',
              'Eşyönlü: $r_{\\text{ISCO}}/M = 3 + Z_2 - \\sqrt{(3 - Z_1)(3 + Z_1 + 2Z_2)}$.',
            ],
            solution: [
              `BPT formülüne $a_* = ${aStar}$ yerleştirilince eşyönlü $r_{\\text{ISCO}} \\approx ${roundSig(rPro, 4)}\\,M$ bulunur.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const aStar = rng.pick([0.5, 0.7, 0.85, 0.95, 0.998]);
      const rPro = kerrIscoGeom(aStar, true);
      const effPct = kerrRadiativeEfficiency(aStar, true) * 100;
      return {
        title: 'Kerr Işınım Verimi: Nükleer Füzyonla Karşılaştırma',
        story: `Hızlı dönen ($a_* = ${aStar}$) bir Kerr kara deliğine eşyönlü bir ince diskten madde akıyor. Parçacıklar ISCO\'ya ulaşana dek bağlanma enerjisini ışınım olarak yayar: $\\eta = 1 - E_{\\text{ISCO}} = 1 - \\sqrt{1 - \\frac{2}{3 r_{\\text{ISCO}}/M}}$.`,
        parts: makeLabels([
          {
            prompt: `Eşyönlü ISCO yarıçapı $r_{\\text{ISCO}} / M$ kaçtır?`,
            kind: 'answer',
            answer: numSpec(rPro, 0.015),
            hints: [
              'Bardeen-Press-Teukolsky formülünü $a_* = ' + aStar + '$ için uygulayın ($a_*=0$ için $6M$, $a_*=0,998$ için $1,237M$).',
            ],
            solution: [
              `BPT formülünden $r_{\\text{ISCO}} / M \\approx ${roundSig(rPro, 4)}$.`,
            ],
          },
          {
            prompt: `İnce diskin kütle-enerji ışınım verimi $\\eta$ yüzde (**%**) kaç olur?`,
            kind: 'answer',
            answer: numSpec(effPct, 0.02),
            hints: [
              '$E_{\\text{ISCO}} = \\sqrt{1 - \\frac{2}{3(r_{\\text{ISCO}}/M)}}$ ve $\\eta = (1 - E_{\\text{ISCO}}) \\times 100$.',
            ],
            solution: [
              `$E_{\\text{ISCO}} = \\sqrt{1 - \\frac{2}{3 \\times ${roundSig(rPro, 4)}}} \\approx ${roundSig(1 - effPct / 100, 4)}$.`,
              `$\\eta = (1 - E_{\\text{ISCO}}) \\times 100 \\approx \\%${roundSig(effPct, 4)}$ (hidrojen füzyonunun $\\%0,7$ veriminden onlarca kat yüksek!).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: eşyönlü vs ters yönlü verim oranı ve foton yörüngeleri
    const aStar = rng.pick([0.7, 0.85, 0.95, 0.998]);
    const effPro = kerrRadiativeEfficiency(aStar, true);
    const effRet = kerrRadiativeEfficiency(aStar, false);
    const rPhPro = kerrPhotonOrbitGeom(aStar, true);
    const rPhRet = kerrPhotonOrbitGeom(aStar, false);
    return {
      title: 'Kerr Foton Yörüngeleri ve Verim Asimetrisi',
      story: `Spini $a_* = ${aStar}$ olan bir Kerr kara deliği etrafında eşyönlü ($+$) ve ters yönlü ($-$) foton yörüngeleri ile disk verimlerini karşılaştırıyoruz.`,
      parts: makeLabels([
        {
          prompt: `Ekvatoryal **eşyönlü** foton yörüngesi yarıçapı $r_{\\text{ph},+} / M = 2\\{1 + \\cos[\\frac{2}{3}\\arccos(-a_*)]\\}$ kaçtır?`,
          kind: 'answer',
          answer: numSpec(rPhPro, 0.015),
          hints: [
            `$\\arccos(-${aStar})$ değerini radyan cinsinden alıp $2/3$ ile çarpın.`,
          ],
          solution: [
            `$r_{\\text{ph},+}/M = 2\\left(1 + \\cos\\left(\\frac{2}{3}\\arccos(-${aStar})\\right)\\right) \\approx ${roundSig(rPhPro, 4)}$ (ters yönlüsü $${roundSig(rPhRet, 4)}\\,M$).`,
          ],
        },
        {
          prompt: `Eşyönlü disk veriminin ters yönlü disk verimine oranı $\\eta_+ / \\eta_-$ kaçtır?`,
          kind: 'answer',
          answer: numSpec(effPro / effRet, 0.02),
          hints: [
            'Önce hem $r_{\\text{ISCO},+}$ hem $r_{\\text{ISCO},-}$ değerlerinden $\\eta_+$ ve $\\eta_-$ hesaplayın.',
          ],
          solution: [
            `$\\eta_+ \\approx \\%${roundSig(effPro * 100, 4)}$, $\\eta_- \\approx \\%${roundSig(effRet * 100, 4)}$.`,
            `Oran: $\\eta_+ / \\eta_- \\approx ${roundSig(effPro / effRet, 4)}$.`,
          ],
        },
      ]),
    };
  },
};

// 14. Kütleçekim dalgaları: cıvıltı kütlesi, birleşme frekansı ve gerinim
const T_GW_CHIRP = {
  id: 'bh-kutlecekim-dalgasi',
  topic: 'Kütleçekim Dalgaları',
  title: 'Kütleçekim Dalgaları: Cıvıltı Kütlesi ve Birleşme Frekansı',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const pair = rng.pick([
        [36, 29],
        [30, 30],
        [20, 15],
        [14, 8],
        [1.46, 1.27],
      ]);
      const [m1Sol, m2Sol] = pair;
      const mcSol = kgToSolarMass(chirpMass(solarMassToKg(m1Sol), solarMassToKg(m2Sol)));
      return {
        title: 'İkili Sistemin Cıvıltı (Chirp) Kütlesi',
        story: `LIGO-Virgo gözlemevleri, bileşen kütleleri $m_1 = ${m1Sol}\\,M_\\odot$ ve $m_2 = ${m2Sol}\\,M_\\odot$ olan sıkı bir ikili sistemin birleşme sinyalini kaydediyor.`,
        parts: makeLabels([
          {
            prompt: `Sistemin cıvıltı kütlesi $\\mathcal{M}_c = \\frac{(m_1 m_2)^{3/5}}{(m_1 + m_2)^{1/5}}$ kaç **$M_\\odot$** olur?`,
            kind: 'answer',
            answer: numSpec(mcSol, 0.015),
            hints: [
              'Kütleler zaten $M_\\odot$ biriminde olduğundan doğrudan $\\frac{(m_1 m_2)^{0,6}}{(m_1 + m_2)^{0,2}}$ hesaplayabilirsiniz.',
              'Eşit kütlelerde ($m_1 = m_2 = m$) $\\mathcal{M}_c = 2^{-1/5} m \\approx 0,8706\\,m$ olur.',
            ],
            solution: [
              `$m_1 m_2 = ${roundSig(m1Sol * m2Sol, 4)}$, $m_1 + m_2 = ${roundSig(m1Sol + m2Sol, 4)}$.`,
              `$\\mathcal{M}_c = \\frac{(${roundSig(m1Sol * m2Sol, 4)})^{3/5}}{(${roundSig(m1Sol + m2Sol, 4)})^{1/5}} \\approx ${roundSig(mcSol, 4)}\\,M_\\odot$.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const pair = rng.pick([[36, 29], [25, 20], [15, 15], [40, 35], [10, 10]]);
      const [m1Sol, m2Sol] = pair;
      const m1 = solarMassToKg(m1Sol);
      const m2 = solarMassToKg(m2Sol);
      const Mtot = m1 + m2;
      const fIsco = gwIscoFrequency(Mtot);
      const rem = gwRemnantProperties(m1, m2);
      const eRadSol = kgToSolarMass(rem.radiatedMassKg);
      return {
        title: 'ISCO Birleşme Frekansı ve Yayılan Kütleçekim Enerjisi',
        story: `Kütleleri $m_1 = ${m1Sol}\\,M_\\odot$ ve $m_2 = ${m2Sol}\\,M_\\odot$ (toplam $M = ${m1Sol + m2Sol}\\,M_\\odot$) olan dönmeyen iki kara delik sarmal yaparak birleşiyor.`,
        parts: makeLabels([
          {
            prompt: `Toplam kütlenin ISCO yörüngesindeki kütleçekim dalgası frekansı $f_{\\text{ISCO}} = \\frac{c^3}{6^{3/2}\\pi G M}$ kaç **Hz** olur?`,
            kind: 'answer',
            answer: numSpec(fIsco, 0.015),
            hints: [
              '$1\\,M_\\odot$ için $f_{\\text{ISCO}} \\approx 4397\\,\\text{Hz}$.',
              'Toplam kütle $M/M_\\odot$ ile bölün.',
            ],
            solution: [
              `$f_{\\text{ISCO}} = \\frac{4397,2\\,\\text{Hz}}{${m1Sol + m2Sol}} \\approx ${roundSig(fIsco, 4)}\\,\\text{Hz}$.`,
            ],
          },
          {
            prompt: `Bu birleşmede kütleçekim dalgalarıyla yayılan enerji yaklaşık kaç **$M_\\odot c^2$** olur? (Eşit/yakın kütleler için toplam kütlenin $\\approx \\%4,8$'i yayılır.)`,
            kind: 'answer',
            answer: numSpec(eRadSol, 0.08),
            hints: [
              'Simetrik kütle oranı $\\nu = \\frac{m_1 m_2}{(m_1+m_2)^2}$ ile $\\Delta E / (Mc^2) \\approx 0,0572\\,\\nu + 0,546\\,\\nu^2$ (yakın kütlelerde $\\approx \\%4,8$).',
            ],
            solution: [
              `$\\nu = ${roundSig(rem.symMassRatio, 4)} \\implies \\frac{\\Delta E}{Mc^2} \\approx \\%${roundSig(rem.radiatedFraction * 100, 3)}$.`,
              `$\\Delta E / c^2 \\approx ${roundSig(eRadSol, 3)}\\,M_\\odot$ (kalıntı kütlesi $\\approx ${roundSig(kgToSolarMass(rem.finalMassKg), 3)}\\,M_\\odot$).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: kalan süre τ(f0), ISCO gerinimi ve QNM çınlama frekansı
    const preset = rng.pick([
      { name: 'GW150914 benzeri', m1: 36, m2: 29, dMpc: 410, f0: 35 },
      { name: 'Ağır İkili', m1: 45, m2: 35, dMpc: 600, f0: 30 },
      { name: 'Orta İkili', m1: 24, m2: 18, dMpc: 300, f0: 40 },
    ]);
    const m1 = solarMassToKg(preset.m1);
    const m2 = solarMassToKg(preset.m2);
    const D = mpcToM(preset.dMpc);
    const Mc = chirpMass(m1, m2);
    const fIsco = gwIscoFrequency(m1 + m2);
    const tau0 = gwTimeToMerger(Mc, preset.f0);
    const hIsco21 = gwStrainAmplitude(Mc, fIsco, D) * 1e21;
    const rem = gwRemnantProperties(m1, m2);
    const fQnm = gwQnmFrequency(rem.finalMassKg, rem.finalSpin);
    return {
      title: `Cıvıltı Süresi, Gerinim Genliği ve Çınlama (${preset.name})`,
      story: `Uzaklığı $D = ${preset.dMpc}\\,\\text{Mpc}$ olan $m_1 = ${preset.m1}\\,M_\\odot$ ve $m_2 = ${preset.m2}\\,M_\\odot$ kütleli ikili kara delik sinyali, detektör bandına $f_0 = ${preset.f0}\\,\\text{Hz}$ frekansında giriyor ($\\mathcal{M}_c \\approx ${roundSig(kgToSolarMass(Mc), 4)}\\,M_\\odot$, $f_{\\text{ISCO}} \\approx ${roundSig(fIsco, 4)}\\,\\text{Hz}$).`,
      parts: makeLabels([
        {
          prompt: `$f_0 = ${preset.f0}\\,\\text{Hz}$ frekansından Newton içe sarmal birleşmesine kadar kalan süre $\\tau(f_0)$ kaç **saniye** olur?`,
          kind: 'answer',
          answer: numSpec(tau0, 0.02),
          hints: [
            '$\\tau(f_0) = \\frac{5}{256}\\left(\\frac{G\\mathcal{M}_c}{c^3}\\right)^{-5/3}(\\pi f_0)^{-8/3}$.',
          ],
          solution: [
            `$t_c = G\\mathcal{M}_c/c^3 = ${fmtLatexSci((G * Mc) / C3, 3)}\\,\\text{s}$.`,
            `$\\tau(${preset.f0}\\,\\text{Hz}) \\approx ${roundSig(tau0, 4)}\\,\\text{s}$.`,
          ],
        },
        {
          prompt: `ISCO frekansında ($f_{\\text{ISCO}} \\approx ${roundSig(fIsco, 4)}\\,\\text{Hz}$) yüz yüze gerinim genliği $h$ kaç **$10^{-21}$** olur (yani $h / 10^{-21}$)?`,
          kind: 'answer',
          answer: numSpec(hIsco21, 0.025),
          hints: [
            '$h(f, D) = \\frac{4c}{D}\\left(\\frac{G\\mathcal{M}_c}{c^3}\\right)^{5/3}(\\pi f)^{2/3}$.',
          ],
          solution: [
            `$h(f_{\\text{ISCO}}, D) = ${fmtLatexSci(hIsco21 * 1e-21, 3)} \\implies h / 10^{-21} \\approx ${roundSig(hIsco21, 4)}$.`,
          ],
        },
        {
          prompt: `Kalıntı kara delik ($M_f \\approx ${roundSig(kgToSolarMass(rem.finalMassKg), 3)}\\,M_\\odot$, $a_f \\approx ${roundSig(rem.finalSpin, 3)}$) için temel QNM çınlama frekansı $f_{\\text{QNM}}$ kaç **Hz** olur?`,
          kind: 'answer',
          answer: numSpec(fQnm, 0.03),
          hints: [
            'Echeverria uyumu: $f_{\\text{QNM}} = \\frac{c^3}{2\\pi G M_f}\\left[1 - 0,63(1 - a_f)^{0,3}\\right]$.',
          ],
          solution: [
            `$f_{\\text{QNM}} = \\frac{32311\\,\\text{Hz}}{${roundSig(kgToSolarMass(rem.finalMassKg), 3)}}\\left[1 - 0,63(1 - ${roundSig(rem.finalSpin, 3)})^{0,3}\\right] \\approx ${roundSig(fQnm, 4)}\\,\\text{Hz}$.`,
          ],
        },
      ]),
    };
  },
};

/** Kara delikler bölümü için 14 otomatik doğrulamalı Türkçe alıştırma şablonu (gtps-kit sözleşmesi). */
export const BH_EXERCISES = [
  T_SCHWARZSCHILD,
  T_SHADOW,
  T_TIME_DILATION,
  T_REDSHIFT,
  T_ISCO_PERIOD,
  T_FREE_FALL,
  T_LENSING,
  T_TIDAL,
  T_HAWKING,
  T_EDDINGTON,
  T_DISK_TEMP,
  T_KERR_HORIZON,
  T_KERR_ISCO,
  T_GW_CHIRP,
];
