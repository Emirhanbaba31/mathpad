// MathPad Engineering Simulation Center — Part 2 Pure Computation Core
// Fields: 'makine' (Makine & Dinamik), 'termo' (Termo & Akışkan), 'havacilik' (Havacılık & Uzay)
// Zero DOM, zero browser globals, zero UI imports — runs directly in Node tests.

export const G0 = 9.80665;               // m/s^2
export const R_UNIV = 8.314462618;       // J/(mol·K)
export const R_AIR = 287.05287;          // J/(kg·K)
export const SIGMA_SB = 5.670374419e-8;  // W/(m^2·K^4)
export const PLANCK_C1 = 3.741771852e-16; // 2*pi*h*c^2  [W·m^2]
export const PLANCK_C2 = 1.438776877e-2;  // h*c/k_B     [m·K]
export const WIEN_B = 2.897771955e-3;     // m·K
export const MU_EARTH = 3.986004418e14;   // m^3/s^2
export const R_EARTH = 6371000;           // m

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Classic fixed-step RK4 integrator for ODE dy/dt = f(t, y). */
export function rk4Step(f, t, y, dt) {
  const n = y.length;
  const k1 = f(t, y);
  const y2 = new Array(n);
  for (let i = 0; i < n; i++) y2[i] = y[i] + 0.5 * dt * k1[i];
  const k2 = f(t + 0.5 * dt, y2);
  const y3 = new Array(n);
  for (let i = 0; i < n; i++) y3[i] = y[i] + 0.5 * dt * k2[i];
  const k3 = f(t + 0.5 * dt, y3);
  const y4 = new Array(n);
  for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i];
  const k4 = f(t + dt, y4);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = y[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

/** Deterministic PRNG (Mulberry32) for reproducible molecular/particle layouts. */
export function makeRng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =====================================================================
// 1. DÖRT ÇUBUK & KRANK-BİYEL MEKANİZMASI (Four-Bar & Slider-Crank)
// =====================================================================

/**
 * Grashof classification for a four-bar linkage (L1 ground, L2 crank, L3 coupler, L4 rocker).
 */
export function classifyGrashof(L1, L2, L3, L4) {
  const arr = [
    { len: L1, idx: 1, name: 'Gövde (L1)' },
    { len: L2, idx: 2, name: 'Krank (L2)' },
    { len: L3, idx: 3, name: 'Biyel (L3)' },
    { len: L4, idx: 4, name: 'Sarkaç (L4)' },
  ].sort((a, b) => a.len - b.len);

  const S = arr[0].len;
  const P = arr[1].len;
  const Q = arr[2].len;
  const L = arr[3].len;
  const sumSL = S + L;
  const sumPQ = P + Q;
  const eps = 1e-5 * Math.max(1, sumPQ);

  if (L >= S + P + Q - eps) {
    return {
      valid: false, grashof: false, type: 'Kurulamaz (kapalı zincir yok)',
      S, L, P, Q, sumSL, sumPQ, fullCrank: false,
    };
  }
  if (Math.abs(sumSL - sumPQ) <= eps) {
    return {
      valid: true, grashof: true, type: 'Değişim Noktalı (S+L = P+Q)',
      S, L, P, Q, sumSL, sumPQ, fullCrank: arr[0].idx === 1 || arr[0].idx === 2,
    };
  }
  if (sumSL < sumPQ) {
    const si = arr[0].idx;
    if (si === 1) {
      return { valid: true, grashof: true, type: 'Çift Krank (Grashof)', S, L, P, Q, sumSL, sumPQ, fullCrank: true };
    }
    if (si === 2) {
      return { valid: true, grashof: true, type: 'Krank-Sarkaç (Grashof)', S, L, P, Q, sumSL, sumPQ, fullCrank: true };
    }
    if (si === 4) {
      return { valid: true, grashof: true, type: 'Sarkaç-Krank (Grashof)', S, L, P, Q, sumSL, sumPQ, fullCrank: false };
    }
    return { valid: true, grashof: true, type: 'Çift Sarkaç (Grashof)', S, L, P, Q, sumSL, sumPQ, fullCrank: false };
  }
  return {
    valid: true, grashof: false, type: 'Grashof Dışı (Üçlü Sarkaç)',
    S, L, P, Q, sumSL, sumPQ, fullCrank: false,
  };
}

/**
 * Compute feasible crank angle range [minTheta, maxTheta] (rad) for four-bar linkage.
 */
export function fourBarCrankRange(L1, L2, L3, L4) {
  // Distance d(theta2) = sqrt(L1^2 + L2^2 - 2*L1*L2*cos(theta2))
  // Feasibility: |L3 - L4| <= d <= L3 + L4
  const dMinReq = Math.abs(L3 - L4);
  const dMaxReq = L3 + L4;
  const dAt0 = Math.abs(L1 - L2);
  const dAtPi = L1 + L2;

  if (dAt0 >= dMinReq - 1e-9 && dAtPi <= dMaxReq + 1e-9) {
    return { full: true, min: 0, max: 2 * Math.PI };
  }
  // cos(theta2) = (L1^2 + L2^2 - d^2) / (2*L1*L2)
  const cosHi = clamp((L1 * L1 + L2 * L2 - dMinReq * dMinReq) / (2 * L1 * L2), -1, 1);
  const cosLo = clamp((L1 * L1 + L2 * L2 - dMaxReq * dMaxReq) / (2 * L1 * L2), -1, 1);
  const tMin = Math.acos(cosHi);
  const tMax = Math.acos(cosLo);
  if (tMin >= tMax - 1e-6) return { full: false, min: 0, max: 0, valid: false };
  return { full: false, min: tMin + 1e-4, max: tMax - 1e-4, valid: true };
}

/**
 * Solve position, velocity, acceleration, transmission angle & coupler point of a 4-bar linkage.
 */
export function solveFourBar({
  L1, L2, L3, L4, theta2, omega2 = 2, alpha2 = 0,
  couplerP = 0.5, couplerGamma = 0, assembly = 1,
}) {
  const O2 = { x: 0, y: 0 };
  const O4 = { x: L1, y: 0 };
  const c2 = Math.cos(theta2), s2 = Math.sin(theta2);
  const A = { x: L2 * c2, y: L2 * s2 };
  const dx = O4.x - A.x;
  const dy = O4.y - A.y;
  const d = Math.hypot(dx, dy);

  if (d < 1e-9 || d > L3 + L4 + 1e-7 || d < Math.abs(L3 - L4) - 1e-7) {
    return { ok: false, O2, O4, A };
  }

  const cosAlpha = clamp((d * d + L3 * L3 - L4 * L4) / (2 * d * L3), -1, 1);
  const phi = Math.atan2(dy, dx);
  const sgn = assembly >= 0 ? 1 : -1;
  const theta3 = phi + sgn * Math.acos(cosAlpha);

  const c3 = Math.cos(theta3), s3 = Math.sin(theta3);
  const B = { x: A.x + L3 * c3, y: A.y + L3 * s3 };
  const theta4 = Math.atan2(B.y - O4.y, B.x - O4.x);
  const c4 = Math.cos(theta4), s4 = Math.sin(theta4);

  const cosMu = clamp((L3 * L3 + L4 * L4 - d * d) / (2 * L3 * L4), -1, 1);
  const mu = Math.acos(cosMu); // transmission angle in rad [0, pi]

  const pLen = couplerP * L3;
  const P = {
    x: A.x + pLen * Math.cos(theta3 + couplerGamma),
    y: A.y + pLen * Math.sin(theta3 + couplerGamma),
  };

  // Velocity & acceleration analysis
  const sin34 = Math.sin(theta3 - theta4);
  let omega3 = 0, omega4 = 0, alpha3 = 0, alpha4 = 0;
  if (Math.abs(sin34) > 1e-7) {
    omega3 = (L2 * omega2 * Math.sin(theta4 - theta2)) / (L3 * sin34);
    omega4 = (L2 * omega2 * Math.sin(theta3 - theta2)) / (L4 * sin34);

    const Rx = L2 * omega2 * omega2 * c2 + L3 * omega3 * omega3 * c3 - L4 * omega4 * omega4 * c4 + L2 * alpha2 * s2;
    const Ry = L2 * omega2 * omega2 * s2 + L3 * omega3 * omega3 * s3 - L4 * omega4 * omega4 * s4 - L2 * alpha2 * c2;
    alpha3 = (-Rx * c4 - Ry * s4) / (L3 * sin34);
    alpha4 = (-Rx * c3 - Ry * s3) / (L4 * sin34);
  }

  return {
    ok: true, O2, O4, A, B, P,
    theta2, theta3, theta4,
    omega2, omega3, omega4,
    alpha2, alpha3, alpha4,
    mu, muDeg: mu * DEG,
  };
}

/**
 * Solve slider-crank linkage (crank r=L2, connecting rod l=L3, offset e).
 */
export function solveSliderCrank({ r, l, offset = 0, theta2, omega2 = 2, alpha2 = 0, couplerP = 0.5 }) {
  const O2 = { x: 0, y: 0 };
  const c2 = Math.cos(theta2), s2 = Math.sin(theta2);
  const A = { x: r * c2, y: r * s2 };
  const sin3 = (offset - r * s2) / l;
  if (Math.abs(sin3) >= 0.999999) {
    return { ok: false, O2, A };
  }
  const theta3 = Math.asin(sin3);
  const c3 = Math.cos(theta3);
  const xB = r * c2 + l * c3;
  const B = { x: xB, y: offset };
  const P = { x: A.x + couplerP * l * c3, y: A.y + couplerP * l * sin3 };

  const omega3 = -(r * omega2 * c2) / (l * c3);
  const vB = -r * omega2 * s2 - l * omega3 * sin3;
  const alpha3 = (r * omega2 * omega2 * s2 + l * omega3 * omega3 * sin3 - r * alpha2 * c2) / (l * c3);
  const aB = -r * omega2 * omega2 * c2 - l * omega3 * omega3 * c3 - l * alpha3 * sin3 - r * alpha2 * s2;
  const mu = Math.PI / 2 - Math.abs(theta3);

  return {
    ok: true, O2, A, B, P,
    theta2, theta3, xB, vB, aB,
    omega2, omega3, alpha2, alpha3,
    mu, muDeg: mu * DEG,
  };
}

/** Sample a full cycle of 4-bar or slider-crank for coupler curve and velocity/accel plots. */
export function sampleLinkageCycle(params, n = 180) {
  const mode = params.mode || 'fourbar';
  const thetas = [], w3 = [], w4 = [], a3 = [], a4 = [], mus = [], curve = [];
  let muMin = 180, muMax = 0;

  if (mode === 'fourbar') {
    const rng = fourBarCrankRange(params.L1, params.L2, params.L3, params.L4);
    const t0 = rng.full ? 0 : rng.min;
    const t1 = rng.full ? 2 * Math.PI : rng.max;
    for (let i = 0; i <= n; i++) {
      const th = t0 + ((t1 - t0) * i) / n;
      const s = solveFourBar({ ...params, theta2: th });
      if (!s.ok) continue;
      thetas.push(th * DEG);
      w3.push(s.omega3);
      w4.push(s.omega4);
      a3.push(s.alpha3);
      a4.push(s.alpha4);
      mus.push(s.muDeg);
      curve.push(s.P);
      if (s.muDeg < muMin) muMin = s.muDeg;
      if (s.muDeg > muMax) muMax = s.muDeg;
    }
  } else {
    for (let i = 0; i <= n; i++) {
      const th = (2 * Math.PI * i) / n;
      const s = solveSliderCrank({ ...params, theta2: th });
      if (!s.ok) continue;
      thetas.push(th * DEG);
      w3.push(s.omega3);
      w4.push(s.vB);   // piston velocity
      a3.push(s.alpha3);
      a4.push(s.aB);   // piston acceleration
      mus.push(s.muDeg);
      curve.push(s.P);
      if (s.muDeg < muMin) muMin = s.muDeg;
      if (s.muDeg > muMax) muMax = s.muDeg;
    }
  }
  return { thetas, w3, w4, a3, a4, mus, curve, muMin: mus.length ? muMin : 0, muMax: mus.length ? muMax : 0 };
}

// =====================================================================
// 2. TİTREŞİM (1-DOF Spring-Mass-Damper, FRF, Transmissibility, Base)
// =====================================================================

export function sdofParams({ m, k, c }) {
  const wn = Math.sqrt(k / m);
  const fn = wn / (2 * Math.PI);
  const cCrit = 2 * Math.sqrt(k * m);
  const zeta = c / cCrit;
  const wd = zeta < 1 ? wn * Math.sqrt(1 - zeta * zeta) : 0;
  const regime = Math.abs(zeta - 1) < 0.015 ? 'Kritik sönümlü'
    : zeta === 0 ? 'Sönümsüz'
    : zeta < 1 ? 'Az sönümlü'
    : 'Aşırı sönümlü';
  const rPeak = zeta < Math.SQRT1_2 ? Math.sqrt(1 - 2 * zeta * zeta) : 0;
  const mPeak = zeta < Math.SQRT1_2 && zeta > 0 ? 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta)) : (zeta === 0 ? Infinity : 1);
  return { wn, fn, cCrit, zeta, wd, regime, rPeak, mPeak };
}

/**
 * Analytical frequency response: magnitude ratio M(r), phase phi(r) [deg], transmissibility TR(r).
 */
export function sdofFRF(r, zeta) {
  const dRe = 1 - r * r;
  const dIm = 2 * zeta * r;
  const denom = Math.hypot(dRe, dIm);
  const mag = denom < 1e-12 ? 1e6 : 1 / denom;
  const phaseRad = Math.atan2(dIm, dRe); // lag angle [0, pi]
  const trNum = Math.hypot(1, dIm);
  const tr = denom < 1e-12 ? 1e6 : trNum / denom;
  const basePhaseRad = Math.atan2(dIm, dRe) - Math.atan2(dIm, 1);
  return {
    r, mag,
    phaseDeg: -phaseRad * DEG, // negative = lagging excitation
    tr,
    basePhaseDeg: -basePhaseRad * DEG,
  };
}

/** Exact analytical free vibration response x(t) and v(t) for m x'' + c x' + k x = 0. */
export function sdofFreeResponse({ m, k, c, x0 = 0.1, v0 = 0, tMax = 6, n = 400 }) {
  const p = sdofParams({ m, k, c });
  const { wn, zeta, wd } = p;
  const ts = [], xs = [], vs = [];
  for (let i = 0; i <= n; i++) {
    const t = (tMax * i) / n;
    let x, v;
    if (zeta < 1 - 1e-7) {
      const env = Math.exp(-zeta * wn * t);
      const A = x0;
      const B = (v0 + zeta * wn * x0) / wd;
      const cw = Math.cos(wd * t), sw = Math.sin(wd * t);
      x = env * (A * cw + B * sw);
      v = env * ((-zeta * wn * A + wd * B) * cw + (-zeta * wn * B - wd * A) * sw);
    } else if (Math.abs(zeta - 1) <= 1e-7) {
      const env = Math.exp(-wn * t);
      const A = x0;
      const B = v0 + wn * x0;
      x = env * (A + B * t);
      v = env * (B - wn * (A + B * t));
    } else {
      const s = Math.sqrt(zeta * zeta - 1);
      const r1 = -wn * (zeta - s);
      const r2 = -wn * (zeta + s);
      const c1 = (v0 - r2 * x0) / (r1 - r2);
      const c2 = (r1 * x0 - v0) / (r1 - r2);
      const e1 = Math.exp(r1 * t), e2 = Math.exp(r2 * t);
      x = c1 * e1 + c2 * e2;
      v = c1 * r1 * e1 + c2 * r2 * e2;
    }
    ts.push(t); xs.push(x); vs.push(v);
  }
  return { ...p, ts, xs, vs };
}

/** RK4 time-domain step for forced or base-excited 1-DOF system. */
export function sdofStep({ m, k, c, mode, F0 = 10, Y0 = 0.05, omega = 5 }, state, t, dt) {
  const deriv = (tt, [x, v]) => {
    let fExt = 0;
    if (mode === 'forced') {
      fExt = F0 * Math.cos(omega * tt);
    } else if (mode === 'base') {
      const y = Y0 * Math.cos(omega * tt);
      const yd = -Y0 * omega * Math.sin(omega * tt);
      fExt = k * y + c * yd;
    }
    return [v, (fExt - c * v - k * x) / m];
  };
  return rk4Step(deriv, t, state, dt);
}

export function sdofFRFCurve(zeta, rMax = 3.5, n = 350) {
  const rs = [], mags = [], phases = [], trs = [];
  for (let i = 0; i <= n; i++) {
    const r = (rMax * i) / n;
    const f = sdofFRF(r, zeta);
    rs.push(r);
    mags.push(Math.min(f.mag, 25));
    phases.push(f.phaseDeg);
    trs.push(Math.min(f.tr, 25));
  }
  return { rs, mags, phases, trs };
}

// =====================================================================
// 3. İKİ SERBESTLİK DERECELİ SİSTEM & TMD (2-DOF Modal & Absorber)
// =====================================================================

/**
 * Modal analysis of 2-DOF system:
 *   wall --(k1,c1)-- m1 --(k2,c2)-- m2 --(k3)-- wall
 */
export function twoDofModal({ m1, m2, k1, k2, k3 = 0 }) {
  const K11 = k1 + k2;
  const K22 = k2 + k3;
  const a = m1 * m2;
  const b = -(m1 * K22 + m2 * K11);
  const c0 = K11 * K22 - k2 * k2;
  const disc = Math.max(0, b * b - 4 * a * c0);
  const lam1 = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a));
  const lam2 = Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
  const w1 = Math.sqrt(lam1);
  const w2 = Math.sqrt(lam2);

  const shape = lam => {
    const v1 = 1;
    const v2 = Math.abs(k2) > 1e-12 ? (K11 - m1 * lam) / k2 : 0;
    const norm = Math.max(Math.abs(v1), Math.abs(v2), 1e-12);
    return [v1 / norm, v2 / norm];
  };

  return {
    w1, w2,
    f1: w1 / (2 * Math.PI),
    f2: w2 / (2 * Math.PI),
    mode1: shape(lam1),
    mode2: shape(lam2),
    wPrimary: Math.sqrt(k1 / m1),
    wAbsorber: Math.sqrt(k2 / m2),
    mu: m2 / m1,
  };
}

/**
 * Complex steady-state FRF for harmonic force F0*e^(i*w*t) applied to m1.
 * Returns |X1|, |X2|, phase1, phase2, and undamped-absorberless baseline |X1_noAbs|.
 */
export function twoDofFRF({ m1, m2, k1, k2, k3 = 0, c1 = 0, c2 = 0, F0 = 1 }, omega) {
  // Complex 2x2 matrix Z = K - w^2 M + i w C
  const z11r = k1 + k2 - m1 * omega * omega;
  const z11i = omega * (c1 + c2);
  const z12r = -k2;
  const z12i = -omega * c2;
  const z22r = k2 + k3 - m2 * omega * omega;
  const z22i = omega * c2;

  // det = z11*z22 - z12^2
  const p1r = z11r * z22r - z11i * z22i;
  const p1i = z11r * z22i + z11i * z22r;
  const p2r = z12r * z12r - z12i * z12i;
  const p2i = 2 * z12r * z12i;
  const dr = p1r - p2r;
  const di = p1i - p2i;
  const d2 = dr * dr + di * di + 1e-24;

  // X1 = F0 * z22 / det; X2 = -F0 * z12 / det
  const x1r = (F0 * (z22r * dr + z22i * di)) / d2;
  const x1i = (F0 * (z22i * dr - z22r * di)) / d2;
  const x2r = (-F0 * (z12r * dr + z12i * di)) / d2;
  const x2i = (-F0 * (z12i * dr - z12r * di)) / d2;

  const noAbsDen = Math.hypot(k1 - m1 * omega * omega, omega * c1) + 1e-12;
  return {
    mag1: Math.hypot(x1r, x1i),
    mag2: Math.hypot(x2r, x2i),
    phase1: Math.atan2(x1i, x1r) * DEG,
    phase2: Math.atan2(x2i, x2r) * DEG,
    magNoAbs: F0 / noAbsDen,
  };
}

/** Den Hartog optimal TMD parameters for mass ratio mu = m2/m1 on primary (m1, k1). */
export function denHartogTMD(m1, k1, mu) {
  const m2 = mu * m1;
  const w1 = Math.sqrt(k1 / m1);
  const fOpt = 1 / (1 + mu);
  const w2 = fOpt * w1;
  const k2 = m2 * w2 * w2;
  const zetaOpt = Math.sqrt((3 * mu) / (8 * (1 + mu)));
  const c2 = 2 * zetaOpt * Math.sqrt(k2 * m2);
  return { m2, k2, c2, fOpt, zetaOpt, w2 };
}

/** RK4 step for 2-DOF system: state = [x1, v1, x2, v2]. */
export function twoDofStep({ m1, m2, k1, k2, k3 = 0, c1 = 0, c2 = 0, F0 = 0, omega = 0 }, state, t, dt) {
  const deriv = (tt, [x1, v1, x2, v2]) => {
    const f1 = F0 * Math.cos(omega * tt) - k1 * x1 - c1 * v1 + k2 * (x2 - x1) + c2 * (v2 - v1);
    const f2 = -k2 * (x2 - x1) - c2 * (v2 - v1) - k3 * x2;
    return [v1, f1 / m1, v2, f2 / m2];
  };
  return rk4Step(deriv, t, state, dt);
}

// =====================================================================
// 4. RİJİT CİSİM ÇARPIŞMASI & EĞİK DÜZLEMDE YUVARLANMA
// =====================================================================

/**
 * Exact 2D rigid disk collision impulse along collision normal n (from body 1 to body 2).
 */
export function collide2DBodies(b1, b2, e = 1) {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const dist = Math.hypot(dx, dy);
  const minDist = b1.r + b2.r;
  if (dist > minDist || dist < 1e-12) return { collided: false, b1, b2, impulse: 0 };

  const nx = dx / dist, ny = dy / dist;
  const rvx = b2.vx - b1.vx, rvy = b2.vy - b1.vy;
  const vn = rvx * nx + rvy * ny;

  // Separate overlap proportionally to inverse mass
  const inv1 = 1 / b1.m, inv2 = 1 / b2.m;
  const overlap = minDist - dist;
  const sep = overlap / (inv1 + inv2);
  const nb1 = { ...b1, x: b1.x - nx * sep * inv1, y: b1.y - ny * sep * inv1 };
  const nb2 = { ...b2, x: b2.x + nx * sep * inv2, y: b2.y + ny * sep * inv2 };

  if (vn >= 0) return { collided: false, b1: nb1, b2: nb2, impulse: 0 };

  const j = (-(1 + clamp(e, 0, 1)) * vn) / (inv1 + inv2);
  nb1.vx -= j * inv1 * nx;
  nb1.vy -= j * inv1 * ny;
  nb2.vx += j * inv2 * nx;
  nb2.vy += j * inv2 * ny;
  return { collided: true, b1: nb1, b2: nb2, impulse: j };
}

/** Momentum & kinetic energy summary of 2D rigid bodies. */
export function bodiesMomentumEnergy(bodies) {
  let px = 0, py = 0, ke = 0;
  for (const b of bodies) {
    px += b.m * b.vx;
    py += b.m * b.vy;
    ke += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
  }
  return { px, py, pMag: Math.hypot(px, py), ke };
}

export const ROLLING_SHAPES = [
  { id: 'block',  label: 'Sürtünmesiz Blok', cI: 0,     formula: '0',            color: '#8b8b94' },
  { id: 'sphere', label: 'Dolu Küre',        cI: 2 / 5, formula: '2/5 mR²',      color: '#5be49b' },
  { id: 'disk',   label: 'Dolu Disk',        cI: 1 / 2, formula: '1/2 mR²',      color: '#5ab0ff' },
  { id: 'hollow', label: 'İçi Boş Küre',     cI: 2 / 3, formula: '2/3 mR²',      color: '#ffd166' },
  { id: 'ring',   label: 'İnce Halka',       cI: 1,     formula: 'mR²',          color: '#ff6b6b' },
];

/**
 * Rolling without slipping (or slipping if mu_s insufficient) on an incline of angle thetaDeg, length L.
 */
export function rollingIncline(cI, { thetaDeg = 25, L = 10, muS = 0.6, g = G0, R = 0.25, m = 2 }) {
  const th = thetaDeg * RAD;
  const sinT = Math.sin(th), cosT = Math.cos(th);
  const muReq = cI > 0 ? (cI / (1 + cI)) * Math.tan(th) : 0;
  const slipping = cI > 0 && muS < muReq - 1e-9;

  let a, alpha, friction;
  if (!slipping) {
    a = (g * sinT) / (1 + cI);
    alpha = cI > 0 ? a / R : 0;
    friction = (cI / (1 + cI)) * m * g * sinT;
  } else {
    // Kinetic slipping: a = g(sin - mu*cos), alpha = (mu*m*g*cos*R) / (cI*m*R^2)
    friction = muS * m * g * cosT;
    a = Math.max(0, g * (sinT - muS * cosT));
    alpha = (muS * g * cosT) / (cI * R);
  }
  const tEnd = a > 1e-9 ? Math.sqrt((2 * L) / a) : Infinity;
  const vEnd = a * tEnd;
  const wEnd = alpha * tEnd;
  const kTrans = 0.5 * m * vEnd * vEnd;
  const kRot = 0.5 * (cI * m * R * R) * wEnd * wEnd;
  const uDrop = m * g * L * sinT;
  return { a, alpha, friction, muReq, slipping, tEnd, vEnd, wEnd, kTrans, kRot, uDrop };
}

// =====================================================================
// 5. DİŞLİ TAKIMI & KAM PROFİLİ (Gear Trains & Cam Profiles)
// =====================================================================

/**
 * Compute gear train speed ratio, output speed, output torque & planetary kinematics.
 */
export function solveGearTrain({
  type = 'simple', N1 = 20, N2 = 40, N3 = 18, N4 = 48,
  useIdler = false, Nid = 24,
  Ns = 20, Np = 15, fixed = 'ring',
  rpmIn = 120, torqueIn = 10, eff = 0.96,
}) {
  if (type === 'simple') {
    const sign = useIdler ? 1 : -1;
    const ratio = sign * (N2 / N1); // omega_in / omega_out (signed)
    const rpmOut = rpmIn / ratio;
    const torqueOut = Math.abs(ratio) * torqueIn * eff;
    const wIn = (rpmIn * 2 * Math.PI) / 60;
    const wOut = (rpmOut * 2 * Math.PI) / 60;
    const wIdler = useIdler ? -(wIn * N1) / Nid : 0;
    return {
      ratio, absRatio: Math.abs(ratio), rpmOut, torqueOut,
      wIn, wOut, wIdler,
      powerIn: torqueIn * wIn,
      powerOut: Math.abs(torqueOut * wOut),
      direction: sign > 0 ? 'Aynı yön' : 'Ters yön',
    };
  }
  if (type === 'compound') {
    // Stage 1: N1 -> N2 (reverses), Stage 2: N3 -> N4 (reverses again -> same direction!)
    const ratio = (N2 / N1) * (N4 / N3);
    const rpmOut = rpmIn / ratio;
    const torqueOut = Math.abs(ratio) * torqueIn * eff;
    const wIn = (rpmIn * 2 * Math.PI) / 60;
    const wMid = -(wIn * N1) / N2;
    const wOut = -(wMid * N3) / N4;
    return {
      ratio, absRatio: Math.abs(ratio), rpmOut, torqueOut,
      wIn, wMid, wOut,
      powerIn: torqueIn * wIn,
      powerOut: Math.abs(torqueOut * wOut),
      direction: 'Aynı yön',
    };
  }
  // Planetary / Epicyclic: Nr = Ns + 2*Np, Willis: (ws - wc)/(wr - wc) = -Nr/Ns
  const Nr = Ns + 2 * Np;
  const wIn = (rpmIn * 2 * Math.PI) / 60;
  let ws = 0, wc = 0, wr = 0, ratio = 1, label = '';
  if (fixed === 'ring') {
    // Input: Sun, Output: Carrier, Fixed: Ring
    ws = wIn;
    wr = 0;
    ratio = 1 + Nr / Ns;
    wc = ws / ratio;
    label = 'Halka sabit (Giriş: Güneş → Çıkış: Taşıyıcı)';
  } else if (fixed === 'sun') {
    // Input: Ring, Output: Carrier, Fixed: Sun
    wr = wIn;
    ws = 0;
    ratio = 1 + Ns / Nr;
    wc = wr / ratio;
    label = 'Güneş sabit (Giriş: Halka → Çıkış: Taşıyıcı)';
  } else {
    // Fixed: Carrier, Input: Sun, Output: Ring
    ws = wIn;
    wc = 0;
    ratio = -Nr / Ns;
    wr = ws / ratio;
    label = 'Taşıyıcı sabit (Giriş: Güneş → Çıkış: Halka)';
  }
  const wpRel = -((ws - wc) * Ns) / Np; // planet spin relative to carrier
  const wpAbs = wc + wpRel;
  const wOut = fixed === 'carrier' ? wr : wc;
  const rpmOut = (wOut * 60) / (2 * Math.PI);
  const torqueOut = Math.abs(ratio) * torqueIn * eff;
  return {
    Nr, Ns, Np, ratio, absRatio: Math.abs(ratio),
    rpmOut, torqueOut, ws, wc, wr, wpRel, wpAbs, wIn, wOut,
    powerIn: torqueIn * wIn,
    powerOut: Math.abs(torqueOut * wOut),
    direction: ratio > 0 ? 'Aynı yön' : 'Ters yön',
    label,
  };
}

/**
 * Evaluate standard cam follower motion law on normalized u in [0, 1] over interval betaRad.
 * Returns dimensionless normalized s/h, (ds/dtheta)/(h/beta), (d2s/dtheta2)/(h/beta^2), (d3s/dtheta3)/(h/beta^3).
 */
export function camLawUnit(law, u) {
  const uu = clamp(u, 0, 1);
  if (law === 'uniform') {
    return { s: uu, v: 1, a: 0, j: 0 };
  }
  if (law === 'harmonic') {
    const pi = Math.PI;
    return {
      s: 0.5 * (1 - Math.cos(pi * uu)),
      v: 0.5 * pi * Math.sin(pi * uu),
      a: 0.5 * pi * pi * Math.cos(pi * uu),
      j: -0.5 * pi * pi * pi * Math.sin(pi * uu),
    };
  }
  if (law === 'poly345') {
    const u2 = uu * uu, u3 = u2 * uu, u4 = u3 * uu, u5 = u4 * uu;
    return {
      s: 10 * u3 - 15 * u4 + 6 * u5,
      v: 30 * u2 - 60 * u3 + 30 * u4,
      a: 60 * uu - 180 * u2 + 120 * u3,
      j: 60 - 360 * uu + 360 * u2,
    };
  }
  // Default: cycloidal
  const tp = 2 * Math.PI;
  return {
    s: uu - Math.sin(tp * uu) / tp,
    v: 1 - Math.cos(tp * uu),
    a: tp * Math.sin(tp * uu),
    j: tp * tp * Math.cos(tp * uu),
  };
}

/**
 * Compute full 360° cam SVAJ profile (s, v, a, j, pressure angle) for Rise-Dwell-Return-Dwell.
 */
export function computeCamProfile({
  law = 'cycloidal', lift = 25, baseR = 40, rollerR = 8,
  riseDeg = 120, dwellHiDeg = 60, returnDeg = 120, omega = 10, n = 360,
}) {
  const b1 = riseDeg * RAD;
  const b2 = (riseDeg + dwellHiDeg) * RAD;
  const b3 = (riseDeg + dwellHiDeg + returnDeg) * RAD;
  const betaR = Math.max(1e-3, riseDeg * RAD);
  const betaF = Math.max(1e-3, returnDeg * RAD);

  const degs = [], sArr = [], vArr = [], aArr = [], jArr = [], phiArr = [];
  let maxV = 0, maxA = 0, maxPhi = 0;

  for (let i = 0; i <= n; i++) {
    const deg = (360 * i) / n;
    const th = deg * RAD;
    let s = 0, dsDth = 0, d2sDth2 = 0, d3sDth3 = 0;

    if (th <= b1) {
      const q = camLawUnit(law, th / betaR);
      s = lift * q.s;
      dsDth = (lift / betaR) * q.v;
      d2sDth2 = (lift / (betaR * betaR)) * q.a;
      d3sDth3 = (lift / (betaR * betaR * betaR)) * q.j;
    } else if (th <= b2) {
      s = lift;
    } else if (th <= b3) {
      const u = (th - b2) / betaF;
      const q = camLawUnit(law, 1 - u);
      s = lift * q.s;
      dsDth = -(lift / betaF) * q.v;
      d2sDth2 = (lift / (betaF * betaF)) * q.a;
      d3sDth3 = -(lift / (betaF * betaF * betaF)) * q.j;
    } else {
      s = 0;
    }

    const v = dsDth * omega;
    const a = d2sDth2 * omega * omega;
    const j = d3sDth3 * omega * omega * omega;
    const phi = Math.atan2(Math.abs(dsDth), baseR + rollerR + s) * DEG;

    degs.push(deg); sArr.push(s); vArr.push(v); aArr.push(a); jArr.push(j); phiArr.push(phi);
    if (Math.abs(v) > maxV) maxV = Math.abs(v);
    if (Math.abs(a) > maxA) maxA = Math.abs(a);
    if (phi > maxPhi) maxPhi = phi;
  }
  return { degs, s: sArr, v: vArr, a: aArr, j: jArr, phi: phiArr, maxV, maxA, maxPhi };
}

// =====================================================================
// 6. MİL BURULMASI & HELİSEL YAY TASARIMI (Shaft Torsion & Spring)
// =====================================================================

/**
 * Solid or hollow circular shaft torsion.
 * Inputs: D [m], d [m] (0 for solid), L [m], G [Pa], T [N·m], SyShear [Pa].
 */
export function solveShaftTorsion({ D, d = 0, L, G, T, SyShear = 250e6 }) {
  const di = Math.min(Math.max(0, d), D * 0.96);
  const J = (Math.PI / 32) * (Math.pow(D, 4) - Math.pow(di, 4));
  const c = D / 2;
  const tauMax = (Math.abs(T) * c) / J;
  const tauInner = (Math.abs(T) * (di / 2)) / J;
  const phiRad = (T * L) / (J * G);
  const phiDeg = phiRad * DEG;
  const twistPerM = phiDeg / Math.max(L, 1e-9);
  const safetyFactor = tauMax > 0 ? SyShear / tauMax : Infinity;
  const area = (Math.PI / 4) * (D * D - di * di);
  const stiffness = (J * G) / L; // N·m/rad
  const strainEnergy = 0.5 * Math.abs(T * phiRad);
  return { J, tauMax, tauInner, phiRad, phiDeg, twistPerM, safetyFactor, area, stiffness, strainEnergy };
}

/**
 * Helical compression spring design with Wahl curvature & direct shear factor.
 * Inputs: d [m] wire dia, D [m] mean coil dia, Na active coils, G [Pa], F [N], SyShear [Pa].
 */
export function solveHelicalSpring({ d, D, Na, G, F, SyShear = 650e6 }) {
  const C = D / d; // spring index
  const Ks = 1 + 0.5 / C; // direct shear factor
  const Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C; // Wahl factor
  const Kb = (4 * C + 2) / (4 * C - 3); // Bergsträsser factor
  const k = (G * Math.pow(d, 4)) / (8 * Math.pow(D, 3) * Na); // N/m
  const deflection = F / k; // m
  const tauNominal = (8 * F * D) / (Math.PI * Math.pow(d, 3));
  const tauWahl = Kw * tauNominal;
  const energy = 0.5 * k * deflection * deflection;
  const safetyFactor = tauWahl > 0 ? SyShear / tauWahl : Infinity;
  const solidLength = (Na + 2) * d; // squared & ground ends
  return { C, Ks, Kw, Kb, k, deflection, tauNominal, tauWahl, energy, safetyFactor, solidLength };
}

// =====================================================================
// 7. ROBOT KOL (2-Link Planar Arm FK, IK, Workspace, Jacobian)
// =====================================================================

export function armForwardKinematics(L1, L2, th1, th2) {
  const x1 = L1 * Math.cos(th1);
  const y1 = L1 * Math.sin(th1);
  const x2 = x1 + L2 * Math.cos(th1 + th2);
  const y2 = y1 + L2 * Math.sin(th1 + th2);
  return { elbow: { x: x1, y: y1 }, ee: { x: x2, y: y2 }, th1, th2 };
}

export function armInverseKinematics(L1, L2, tx, ty, elbowUp = false) {
  const rRaw = Math.hypot(tx, ty);
  const rMin = Math.abs(L1 - L2);
  const rMax = L1 + L2;
  const reachable = rRaw >= rMin - 1e-9 && rRaw <= rMax + 1e-9;

  let x = tx, y = ty;
  if (!reachable) {
    const rClamped = clamp(rRaw, rMin + 1e-6, rMax - 1e-6);
    const ang = rRaw > 1e-9 ? Math.atan2(ty, tx) : 0;
    x = rClamped * Math.cos(ang);
    y = rClamped * Math.sin(ang);
  }
  const r2 = x * x + y * y;
  const cos2 = clamp((r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
  const sin2Mag = Math.sqrt(Math.max(0, 1 - cos2 * cos2));
  const sin2 = elbowUp ? -sin2Mag : sin2Mag;
  const th2 = Math.atan2(sin2, cos2);
  const th1 = Math.atan2(y, x) - Math.atan2(L2 * sin2, L1 + L2 * cos2);

  // Alternate solution
  const th2Alt = -th2;
  const th1Alt = Math.atan2(y, x) - Math.atan2(L2 * (-sin2), L1 + L2 * cos2);

  return {
    reachable, rRaw, rMin, rMax,
    th1, th2, th1Alt, th2Alt,
    fk: armForwardKinematics(L1, L2, th1, th2),
    fkAlt: armForwardKinematics(L1, L2, th1Alt, th2Alt),
  };
}

/**
 * 2x2 geometric Jacobian, determinant, singular values & manipulability ellipse axes.
 */
export function armJacobian(L1, L2, th1, th2) {
  const s1 = Math.sin(th1), c1 = Math.cos(th1);
  const s12 = Math.sin(th1 + th2), c12 = Math.cos(th1 + th2);
  const j11 = -L1 * s1 - L2 * s12;
  const j12 = -L2 * s12;
  const j21 = L1 * c1 + L2 * c12;
  const j22 = L2 * c12;
  const det = j11 * j22 - j12 * j21; // exact identity: L1 * L2 * sin(th2)

  // Singular values from symmetric 2x2 matrix A = J * J^T
  const a11 = j11 * j11 + j12 * j12;
  const a12 = j11 * j21 + j12 * j22;
  const a22 = j21 * j21 + j22 * j22;
  const tr = a11 + a22;
  const diff = a11 - a22;
  const rad = Math.hypot(diff, 2 * a12);
  const lam1 = Math.max(0, 0.5 * (tr + rad));
  const lam2 = Math.max(0, 0.5 * (tr - rad));
  const sigma1 = Math.sqrt(lam1);
  const sigma2 = Math.sqrt(lam2);
  const cond = sigma2 > 1e-9 ? sigma1 / sigma2 : Infinity;
  const ellipseAngle = 0.5 * Math.atan2(2 * a12, diff);
  const singular = Math.abs(Math.sin(th2)) < 0.08;

  return {
    J: [[j11, j12], [j21, j22]],
    det,
    manipulability: Math.abs(det),
    sigma1, sigma2, cond,
    ellipseAngle, singular,
  };
}

// =====================================================================
// 8. SARKAÇ & JİROSKOP (Pendulums & Gyroscope Precession)
// =====================================================================

/** Complete elliptic integral of the first kind K(k) via Arithmetic-Geometric Mean. */
export function ellipticK(k) {
  const kk = clamp(Math.abs(k), 0, 0.999999999);
  let a = 1;
  let b = Math.sqrt(1 - kk * kk);
  for (let i = 0; i < 24; i++) {
    const an = 0.5 * (a + b);
    const bn = Math.sqrt(a * b);
    if (Math.abs(an - bn) < 1e-13) { a = an; break; }
    a = an; b = bn;
  }
  return Math.PI / (2 * a);
}

/** Exact nonlinear vs small-angle period of simple pendulum. */
export function pendulumPeriods(L, theta0Rad, g = G0) {
  const T0 = 2 * Math.PI * Math.sqrt(L / g);
  const k = Math.sin(Math.abs(theta0Rad) / 2);
  const Texact = 4 * Math.sqrt(L / g) * ellipticK(k);
  const relErrPct = ((Texact - T0) / Texact) * 100;
  return { T0, Texact, ratio: Texact / T0, relErrPct, w0: Math.sqrt(g / L) };
}

/** RK4 step for damped/undamped nonlinear pendulum: theta'' + (b)*theta' + (g/Leq)*sin(theta) = 0. */
export function pendulumStep({ Leq, g = G0, damping = 0 }, state, dt) {
  const deriv = (_t, [th, w]) => [w, -(g / Leq) * Math.sin(th) - damping * w];
  return rk4Step(deriv, 0, state, dt);
}

/** Physical pendulum properties for common rigid shapes (or custom Icm, d). */
export function physicalPendulum({ shape = 'rod', m = 2, L = 1.2, R = 0.5, dCustom = 0.4, IcmCustom = 0.2, g = G0 }) {
  let Icm, d, desc;
  if (shape === 'rod') {
    Icm = (1 / 12) * m * L * L;
    d = L / 2;
    desc = 'İnce çubuk (uçtan asılı)';
  } else if (shape === 'disk') {
    Icm = 0.5 * m * R * R;
    d = R;
    desc = 'Dolu disk (kenardan asılı)';
  } else if (shape === 'ring') {
    Icm = m * R * R;
    d = R;
    desc = 'İnce halka (kenardan asılı)';
  } else {
    Icm = Math.max(1e-4, IcmCustom);
    d = Math.max(0.05, dCustom);
    desc = 'Özel rijit cisim';
  }
  const Io = Icm + m * d * d; // parallel-axis theorem
  const Leq = Io / (m * d);   // center of percussion distance
  const w0 = Math.sqrt((m * g * d) / Io);
  const T0 = (2 * Math.PI) / w0;
  return { Icm, Io, d, Leq, w0, T0, desc };
}

/** Gyroscope steady precession rate & fast-top criterion. */
export function gyroscopePrecession({ m = 1.2, R = 0.12, r = 0.15, rpm = 1800, tiltDeg = 30, shape = 'disk', g = G0 }) {
  const cSpin = shape === 'ring' ? 1.0 : 0.5;
  const Is = cSpin * m * R * R;
  const Iperp = 0.5 * Is + m * r * r;
  const ws = (rpm * 2 * Math.PI) / 60;
  const Ls = Is * ws;
  const tilt = tiltDeg * RAD;
  const torque = m * g * r * Math.sin(tilt);
  const omegaP = Ls > 1e-9 ? (m * g * r) / Ls : Infinity; // rad/s
  const periodP = omegaP > 1e-9 && Number.isFinite(omegaP) ? (2 * Math.PI) / omegaP : Infinity;
  const nutationFreq = Iperp > 1e-9 ? Ls / Iperp : 0;
  const fastTopRatio = (Ls * Ls) / Math.max(1e-9, 4 * Iperp * m * g * r * Math.max(0.05, Math.cos(tilt)));
  const isFastTop = fastTopRatio > 4;
  return { Is, Iperp, ws, Ls, torque, omegaP, rpmP: (omegaP * 60) / (2 * Math.PI), periodP, nutationFreq, fastTopRatio, isFastTop, sleepingStable: fastTopRatio > 1 };
}

// =====================================================================
// 9. TERMODİNAMİK ÇEVRİMLER (Otto, Diesel, Brayton, Carnot, Rankine, VCR)
// =====================================================================

// IAPWS-95 Water saturation anchor table: [P_kPa, T_C, vf, vg, hf, hg, sf, sg]
const WATER_SAT = [
  [5,      32.88,  0.001005, 28.192,  137.75, 2560.7, 0.4762, 8.3938],
  [10,     45.81,  0.001010, 14.670,  191.81, 2583.9, 0.6492, 8.1488],
  [20,     60.06,  0.001017,  7.6481, 251.42, 2608.9, 0.8320, 7.9073],
  [50,     81.32,  0.001030,  3.2403, 340.54, 2645.2, 1.0912, 7.5931],
  [101.33, 99.97,  0.001043,  1.6734, 419.06, 2675.6, 1.3069, 7.3545],
  [200,   120.21,  0.001061,  0.8858, 504.70, 2706.3, 1.5302, 7.1270],
  [500,   151.83,  0.001093,  0.3748, 640.09, 2748.1, 1.8604, 6.8207],
  [1000,  179.88,  0.001127,  0.1944, 762.51, 2777.1, 2.1381, 6.5850],
  [2000,  212.38,  0.001177,  0.0996, 908.47, 2798.3, 2.4467, 6.3390],
  [3000,  233.85,  0.001217,  0.0667, 1008.3, 2803.2, 2.6454, 6.1856],
  [5000,  263.94,  0.001286,  0.03945, 1154.5, 2794.2, 2.9207, 5.9737],
  [8000,  295.01,  0.001384,  0.02353, 1316.7, 2758.7, 3.2077, 5.7450],
  [10000, 311.00,  0.001453,  0.01803, 1407.9, 2725.5, 3.3603, 5.6159],
  [15000, 342.16,  0.001657,  0.01034, 1610.3, 2610.7, 3.6846, 5.3108],
  [20000, 365.75,  0.002038,  0.00586, 1827.2, 2412.3, 4.0156, 4.9314],
  [22064, 373.95,  0.003106,  0.00311, 2084.3, 2084.3, 4.4070, 4.4070],
];

// R-134a saturation table (Çengel Table A-11): [T_C, P_kPa, vf, vg, hf, hg, sf, sg]
const R134A_SAT = [
  [-40,   51.25, 0.000705, 0.36081,   0.00, 225.86, 0.00000, 0.96866],
  [-30,   84.43, 0.000720, 0.22580,  12.59, 232.19, 0.05282, 0.95579],
  [-20,  132.82, 0.000736, 0.14729,  25.49, 238.41, 0.10486, 0.94596],
  [-10,  200.74, 0.000754, 0.09959,  38.55, 244.51, 0.15504, 0.93766],
  [0,    292.93, 0.000772, 0.06931,  51.86, 250.45, 0.20439, 0.93139],
  [10,   414.89, 0.000793, 0.04944,  65.43, 256.16, 0.25286, 0.92661],
  [20,   572.07, 0.000816, 0.03600,  79.32, 261.59, 0.30063, 0.92289],
  [30,   770.64, 0.000842, 0.02665,  93.58, 266.66, 0.34789, 0.91977],
  [40,  1017.10, 0.000872, 0.01997, 108.28, 271.25, 0.39486, 0.91683],
  [50,  1318.60, 0.000907, 0.01509, 123.49, 275.22, 0.44177, 0.91367],
  [60,  1682.80, 0.000950, 0.01144, 139.37, 278.37, 0.48899, 0.90984],
  [70,  2118.20, 0.001004, 0.00865, 156.15, 280.36, 0.53705, 0.90472],
  [80,  2635.30, 0.001078, 0.00644, 174.26, 280.60, 0.58711, 0.89725],
  [90,  3246.90, 0.001195, 0.00457, 194.82, 277.38, 0.64197, 0.88420],
  [101.06, 4059.3, 0.001954, 0.001954, 241.5, 241.5, 0.7610, 0.7610],
];

export function waterSatByP(PkPa) {
  const P = clamp(PkPa, WATER_SAT[0][0], WATER_SAT[WATER_SAT.length - 1][0]);
  const lnP = Math.log(P);
  let i = 0;
  while (i < WATER_SAT.length - 2 && WATER_SAT[i + 1][0] < P) i++;
  const a = WATER_SAT[i], b = WATER_SAT[i + 1];
  const u = (lnP - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
  const lerp = (k) => a[k] + u * (b[k] - a[k]);
  const logLerp = (k) => Math.exp(Math.log(a[k]) + u * (Math.log(b[k]) - Math.log(a[k])));
  const T_C = lerp(1);
  return {
    P, T_C, T: T_C + 273.15,
    vf: lerp(2), vg: logLerp(3),
    hf: lerp(4), hg: lerp(5),
    sf: lerp(6), sg: lerp(7),
  };
}

/** Superheated steam cp approximation [kJ/(kg·K)] calibrated to IAPWS-95 across 0.01–18 MPa. */
function steamCp(PkPa, T_C, Ts_C) {
  const pMPa = PkPa / 1000;
  const dT = Math.max(0, T_C - Ts_C);
  const cp0 = 1.855 + 0.00046 * T_C + 2.2e-7 * T_C * T_C;
  const cpExcess = (0.36 * Math.pow(pMPa, 0.82)) / (1 + 0.011 * dT * Math.pow(Math.max(0.2, pMPa), -0.25));
  return cp0 + cpExcess;
}

/** Superheated steam properties (h [kJ/kg], s [kJ/(kg·K)], v [m^3/kg]) for T_C >= Tsat(P). */
export function waterSuperheated(PkPa, T_C) {
  const sat = waterSatByP(PkPa);
  const T = Math.max(sat.T, T_C + 273.15);
  const steps = 16;
  const dT = (T - sat.T) / steps;
  let dh = 0, ds = 0;
  for (let i = 0; i < steps; i++) {
    const Tm = sat.T + (i + 0.5) * dT;
    const cp = steamCp(PkPa, Tm - 273.15, sat.T_C);
    dh += cp * dT;
    ds += (cp / Tm) * dT;
  }
  const h = sat.hg + dh;
  const s = sat.sg + ds;
  // Specific volume via ideal-gas scaled from saturated vapour
  const v = sat.vg * (T / sat.T);
  return { P: PkPa, T, T_C: T - 273.15, h, s, v };
}

export function r134aSatByT(T_C) {
  const Tc = clamp(T_C, R134A_SAT[0][0], R134A_SAT[R134A_SAT.length - 1][0]);
  let i = 0;
  while (i < R134A_SAT.length - 2 && R134A_SAT[i + 1][0] < Tc) i++;
  const a = R134A_SAT[i], b = R134A_SAT[i + 1];
  const u = (Tc - a[0]) / (b[0] - a[0]);
  const lerp = k => a[k] + u * (b[k] - a[k]);
  const logLerp = k => Math.exp(Math.log(a[k]) + u * (Math.log(b[k]) - Math.log(a[k])));
  return {
    T_C: Tc, T: Tc + 273.15,
    P: logLerp(1),
    vf: lerp(2), vg: logLerp(3),
    hf: lerp(4), hg: lerp(5),
    sf: lerp(6), sg: lerp(7),
  };
}

/**
 * Solve any of the 6 thermodynamic cycles: 'otto' | 'diesel' | 'brayton' | 'carnot' | 'rankine' | 'vcr'.
 * Returns states (1..4), P-v and T-s curve points, dome points (for rankine/vcr), work, heat, efficiency/COP.
 */
export function solveThermoCycle(opts) {
  const type = opts.type || 'otto';
  const gamma = opts.gamma ?? 1.4;
  const R = R_AIR / 1000; // kJ/(kg·K)
  const cv = R / (gamma - 1);
  const cp = (gamma * R) / (gamma - 1);
  const Nseg = 40;

  if (type === 'otto') {
    const r = clamp(opts.r ?? 9, 2, 22);
    const T1 = clamp(opts.T1 ?? 300, 220, 450);
    const P1 = clamp(opts.P1 ?? 100, 50, 300); // kPa
    const T3 = Math.max(T1 * Math.pow(r, gamma - 1) + 100, opts.T3 ?? 2200);
    const v1 = (R * T1) / P1;
    const v2 = v1 / r;
    const T2 = T1 * Math.pow(r, gamma - 1);
    const P2 = P1 * Math.pow(r, gamma);
    const v3 = v2;
    const P3 = P2 * (T3 / T2);
    const v4 = v1;
    const T4 = T3 * Math.pow(r, 1 - gamma);
    const P4 = P3 * Math.pow(r, -gamma);

    const s1 = 0, s2 = 0;
    const s3 = cv * Math.log(T3 / T2);
    const s4 = s3;
    const qIn = cv * (T3 - T2);
    const qOut = cv * (T4 - T1);
    const wNet = qIn - qOut;
    const eff = wNet / qIn; // = 1 - r^(1-gamma)
    const mep = wNet / (v1 - v2);
    const carnotEff = 1 - T1 / T3;

    const pv = [], ts = [];
    // 1->2 isentropic
    for (let i = 0; i <= Nseg; i++) {
      const v = v1 + ((v2 - v1) * i) / Nseg;
      const P = P1 * Math.pow(v1 / v, gamma);
      const T = (P * v) / R;
      pv.push([v, P]); ts.push([s1, T]);
    }
    // 2->3 isochoric
    for (let i = 1; i <= Nseg; i++) {
      const T = T2 + ((T3 - T2) * i) / Nseg;
      const P = (R * T) / v2;
      const s = s2 + cv * Math.log(T / T2);
      pv.push([v2, P]); ts.push([s, T]);
    }
    // 3->4 isentropic
    for (let i = 1; i <= Nseg; i++) {
      const v = v3 + ((v4 - v3) * i) / Nseg;
      const P = P3 * Math.pow(v3 / v, gamma);
      const T = (P * v) / R;
      pv.push([v, P]); ts.push([s3, T]);
    }
    // 4->1 isochoric
    for (let i = 1; i <= Nseg; i++) {
      const T = T4 + ((T1 - T4) * i) / Nseg;
      const P = (R * T) / v1;
      const s = s4 + cv * Math.log(T / T4);
      pv.push([v1, P]); ts.push([s, T]);
    }
    return {
      type, isRefrig: false, qIn, qOut, wNet, eff, carnotEff, mep,
      states: [
        { id: 1, T: T1, P: P1, v: v1, s: s1 },
        { id: 2, T: T2, P: P2, v: v2, s: s2 },
        { id: 3, T: T3, P: P3, v: v3, s: s3 },
        { id: 4, T: T4, P: P4, v: v4, s: s4 },
      ],
      pv, ts, domePV: null, domeTS: null,
    };
  }

  if (type === 'diesel') {
    const r = clamp(opts.r ?? 18, 6, 26);
    const rc = clamp(opts.rc ?? 2.2, 1.1, Math.min(4.5, r * 0.8));
    const T1 = clamp(opts.T1 ?? 300, 220, 450);
    const P1 = clamp(opts.P1 ?? 100, 50, 300);
    const v1 = (R * T1) / P1;
    const v2 = v1 / r;
    const T2 = T1 * Math.pow(r, gamma - 1);
    const P2 = P1 * Math.pow(r, gamma);
    const P3 = P2;
    const v3 = rc * v2;
    const T3 = rc * T2;
    const v4 = v1;
    const T4 = T3 * Math.pow(rc / r, gamma - 1);
    const P4 = P3 * Math.pow(rc / r, gamma);

    const s1 = 0, s2 = 0;
    const s3 = cp * Math.log(T3 / T2);
    const s4 = s3;
    const qIn = cp * (T3 - T2);
    const qOut = cv * (T4 - T1);
    const wNet = qIn - qOut;
    const eff = wNet / qIn;
    const mep = wNet / (v1 - v2);
    const carnotEff = 1 - T1 / T3;

    const pv = [], ts = [];
    for (let i = 0; i <= Nseg; i++) {
      const v = v1 + ((v2 - v1) * i) / Nseg;
      const P = P1 * Math.pow(v1 / v, gamma);
      pv.push([v, P]); ts.push([s1, (P * v) / R]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const T = T2 + ((T3 - T2) * i) / Nseg;
      const v = (R * T) / P2;
      pv.push([v, P2]); ts.push([s2 + cp * Math.log(T / T2), T]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const v = v3 + ((v4 - v3) * i) / Nseg;
      const P = P3 * Math.pow(v3 / v, gamma);
      pv.push([v, P]); ts.push([s3, (P * v) / R]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const T = T4 + ((T1 - T4) * i) / Nseg;
      const P = (R * T) / v1;
      pv.push([v1, P]); ts.push([s4 + cv * Math.log(T / T4), T]);
    }
    return {
      type, isRefrig: false, qIn, qOut, wNet, eff, carnotEff, mep,
      states: [
        { id: 1, T: T1, P: P1, v: v1, s: s1 },
        { id: 2, T: T2, P: P2, v: v2, s: s2 },
        { id: 3, T: T3, P: P3, v: v3, s: s3 },
        { id: 4, T: T4, P: P4, v: v4, s: s4 },
      ],
      pv, ts, domePV: null, domeTS: null,
    };
  }

  if (type === 'brayton') {
    const rp = clamp(opts.rp ?? 10, 2, 30);
    const T1 = clamp(opts.T1 ?? 300, 220, 420);
    const P1 = clamp(opts.P1 ?? 100, 50, 300);
    const exp = (gamma - 1) / gamma;
    const T2 = T1 * Math.pow(rp, exp);
    const T3 = Math.max(T2 + 120, opts.T3 ?? 1400);
    const P2 = P1 * rp, P3 = P2, P4 = P1;
    const T4 = T3 * Math.pow(rp, -exp);
    const v1 = (R * T1) / P1, v2 = (R * T2) / P2, v3 = (R * T3) / P3, v4 = (R * T4) / P4;
    const s1 = 0, s2 = 0, s3 = cp * Math.log(T3 / T2), s4 = s3;
    const wc = cp * (T2 - T1), wt = cp * (T3 - T4);
    const qIn = cp * (T3 - T2), qOut = cp * (T4 - T1);
    const wNet = wt - wc;
    const eff = wNet / qIn;
    const bwr = wc / wt;
    const carnotEff = 1 - T1 / T3;

    const pv = [], ts = [];
    for (let i = 0; i <= Nseg; i++) {
      const P = P1 + ((P2 - P1) * i) / Nseg;
      const T = T1 * Math.pow(P / P1, exp);
      pv.push([(R * T) / P, P]); ts.push([s1, T]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const T = T2 + ((T3 - T2) * i) / Nseg;
      pv.push([(R * T) / P2, P2]); ts.push([cp * Math.log(T / T2), T]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const P = P3 + ((P4 - P3) * i) / Nseg;
      const T = T3 * Math.pow(P / P3, exp);
      pv.push([(R * T) / P, P]); ts.push([s3, T]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const T = T4 + ((T1 - T4) * i) / Nseg;
      pv.push([(R * T) / P1, P1]); ts.push([s4 + cp * Math.log(T / T4), T]);
    }
    return {
      type, isRefrig: false, qIn, qOut, wNet, wc, wt, bwr, eff, carnotEff,
      states: [
        { id: 1, T: T1, P: P1, v: v1, s: s1 },
        { id: 2, T: T2, P: P2, v: v2, s: s2 },
        { id: 3, T: T3, P: P3, v: v3, s: s3 },
        { id: 4, T: T4, P: P4, v: v4, s: s4 },
      ],
      pv, ts, domePV: null, domeTS: null,
    };
  }

  if (type === 'carnot') {
    const TL = clamp(opts.TL ?? 300, 200, 600);
    const TH = Math.max(TL + 60, opts.TH ?? 900);
    const rIso = clamp(opts.rIso ?? 2.5, 1.2, 6);
    const P1 = 500; // kPa at state 1 (start of isothermal expansion at TH)
    const v1 = (R * TH) / P1;
    const v2 = v1 * rIso;
    const P2 = P1 / rIso;
    const v3 = v2 * Math.pow(TH / TL, 1 / (gamma - 1));
    const P3 = (R * TL) / v3;
    const v4 = v1 * Math.pow(TH / TL, 1 / (gamma - 1));
    const P4 = (R * TL) / v4;

    const s1 = 0, s2 = R * Math.log(rIso), s3 = s2, s4 = 0;
    const qIn = R * TH * Math.log(rIso);
    const qOut = R * TL * Math.log(rIso);
    const wNet = qIn - qOut;
    const eff = 1 - TL / TH;

    const pv = [], ts = [];
    for (let i = 0; i <= Nseg; i++) {
      const v = v1 + ((v2 - v1) * i) / Nseg;
      pv.push([v, (R * TH) / v]); ts.push([R * Math.log(v / v1), TH]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const v = v2 + ((v3 - v2) * i) / Nseg;
      const T = TH * Math.pow(v2 / v, gamma - 1);
      pv.push([v, (R * T) / v]); ts.push([s2, T]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const v = v3 + ((v4 - v3) * i) / Nseg;
      pv.push([v, (R * TL) / v]); ts.push([s2 + R * Math.log(v / v3), TL]);
    }
    for (let i = 1; i <= Nseg; i++) {
      const v = v4 + ((v1 - v4) * i) / Nseg;
      const T = TL * Math.pow(v4 / v, gamma - 1);
      pv.push([v, (R * T) / v]); ts.push([s4, T]);
    }
    return {
      type, isRefrig: false, qIn, qOut, wNet, eff, carnotEff: eff,
      states: [
        { id: 1, T: TH, P: P1, v: v1, s: s1 },
        { id: 2, T: TH, P: P2, v: v2, s: s2 },
        { id: 3, T: TL, P: P3, v: v3, s: s3 },
        { id: 4, T: TL, P: P4, v: v4, s: s4 },
      ],
      pv, ts, domePV: null, domeTS: null,
    };
  }

  if (type === 'rankine') {
    const Pcond = clamp(opts.Pcond ?? 10, 5, 500);       // kPa
    const Pboil = clamp(opts.Pboil ?? 3000, Math.max(Pcond + 200, 500), 18000); // kPa
    const satC = waterSatByP(Pcond);
    const satB = waterSatByP(Pboil);
    const T3_C = Math.max(satB.T_C + 5, opts.T3_C ?? 400);

    // State 1: sat liquid at Pcond
    const s1 = satC.sf, h1 = satC.hf, v1 = satC.vf, T1 = satC.T;
    // State 2: compressed liquid after pump
    const wp = v1 * (Pboil - Pcond); // kJ/kg (m^3/kg * kPa = kJ/kg)
    const h2 = h1 + wp, s2 = s1, v2 = v1, T2 = T1 + wp / 4.18;
    // State 3: superheated steam at (Pboil, T3_C)
    const st3 = waterSuperheated(Pboil, T3_C);
    // State 4: isentropic expansion s4 = s3 to Pcond
    const s4 = st3.s;
    let h4, T4, v4, x4;
    if (s4 <= satC.sg) {
      x4 = clamp((s4 - satC.sf) / (satC.sg - satC.sf), 0, 1);
      h4 = satC.hf + x4 * (satC.hg - satC.hf);
      v4 = satC.vf + x4 * (satC.vg - satC.vf);
      T4 = satC.T;
    } else {
      x4 = 1;
      // Solve T4 > satC.T where superheated s(Pcond, T4) == s4 by bisection
      let lo = satC.T_C, hi = T3_C;
      for (let it = 0; it < 28; it++) {
        const mid = 0.5 * (lo + hi);
        if (waterSuperheated(Pcond, mid).s < s4) lo = mid; else hi = mid;
      }
      const st4 = waterSuperheated(Pcond, 0.5 * (lo + hi));
      h4 = st4.h; v4 = st4.v; T4 = st4.T;
    }

    const wt = st3.h - h4;
    const wNet = wt - wp;
    const qIn = st3.h - h2;
    const qOut = h4 - h1;
    const eff = wNet / qIn;
    const carnotEff = 1 - T1 / st3.T;
    const bwr = wp / wt;

    // Build dome curves
    const domeTS = [
      ...WATER_SAT.map(r => [r[6], r[1] + 273.15]),
      ...WATER_SAT.slice(0, -1).reverse().map(r => [r[7], r[1] + 273.15]),
    ];
    const domePV = [
      ...WATER_SAT.map(r => [r[2], r[0]]),
      ...WATER_SAT.slice(0, -1).reverse().map(r => [r[3], r[0]]),
    ];

    // Build T-s and P-v paths
    const ts = [[s1, T1], [s2, T2]];
    // 2 -> sat liquid at Pboil
    for (let i = 1; i <= 14; i++) {
      const f = i / 14;
      ts.push([s2 + f * (satB.sf - s2), T2 + f * (satB.T - T2)]);
    }
    // sat liquid -> sat vapor at Pboil
    ts.push([satB.sg, satB.T]);
    // superheat to state 3
    for (let i = 1; i <= 14; i++) {
      const tc = satB.T_C + ((T3_C - satB.T_C) * i) / 14;
      const sh = waterSuperheated(Pboil, tc);
      ts.push([sh.s, sh.T]);
    }
    // 3 -> 4 isentropic, 4 -> 1 condenser
    ts.push([s4, T4], [s1, T1]);

    const pv = [[v1, Pcond], [v2, Pboil], [satB.vf, Pboil], [satB.vg, Pboil], [st3.v, Pboil]];
    for (let i = 1; i <= 18; i++) {
      const P = Math.exp(Math.log(Pboil) + ((Math.log(Pcond) - Math.log(Pboil)) * i) / 18);
      const sp = waterSatByP(P);
      let v;
      if (s4 <= sp.sg) {
        const x = clamp((s4 - sp.sf) / (sp.sg - sp.sf), 0, 1);
        v = sp.vf + x * (sp.vg - sp.vf);
      } else {
        v = sp.vg * Math.exp((s4 - sp.sg) / 2.0);
      }
      pv.push([v, P]);
    }
    pv.push([v1, Pcond]);

    return {
      type, isRefrig: false, qIn, qOut, wNet, wt, wp, bwr, eff, carnotEff, x4,
      states: [
        { id: 1, T: T1, P: Pcond, v: v1, h: h1, s: s1, x: 0 },
        { id: 2, T: T2, P: Pboil, v: v2, h: h2, s: s2, x: null },
        { id: 3, T: st3.T, P: Pboil, v: st3.v, h: st3.h, s: st3.s, x: null },
        { id: 4, T: T4, P: Pcond, v: v4, h: h4, s: s4, x: x4 },
      ],
      pv, ts, domePV, domeTS,
    };
  }

  // Vapour-Compression Refrigeration (R-134a)
  const Tevap = clamp(opts.Tevap ?? -10, -35, 15);
  const Tcond = clamp(opts.Tcond ?? 40, Math.max(Tevap + 15, 20), 75);
  const ev = r134aSatByT(Tevap);
  const co = r134aSatByT(Tcond);

  // State 1: sat vapor at Tevap
  const h1 = ev.hg, s1 = ev.sg, v1 = ev.vg, T1 = ev.T;
  // State 2: isentropic compression s2 = s1 to Pcond (superheated R-134a)
  const cpV = 0.95 + 0.0045 * Math.max(0, Tcond); // kJ/(kg·K) for R-134a vapour near cond
  const s2 = s1;
  const dsSup = Math.max(0, s2 - co.sg);
  const T2 = co.T * Math.exp(dsSup / cpV);
  const h2 = co.hg + cpV * (T2 - co.T);
  const v2 = co.vg * (T2 / co.T);
  // State 3: sat liquid at Tcond
  const h3 = co.hf, s3 = co.sf, v3 = co.vf, T3 = co.T;
  // State 4: isenthalpic throttle h4 = h3 to Pevap
  const h4 = h3;
  const x4 = clamp((h4 - ev.hf) / (ev.hg - ev.hf), 0, 1);
  const s4 = ev.sf + x4 * (ev.sg - ev.sf);
  const v4 = ev.vf + x4 * (ev.vg - ev.vf);
  const T4 = ev.T;

  const qL = h1 - h4;
  const qH = h2 - h3;
  const wIn = h2 - h1;
  const copR = qL / wIn;
  const copHP = qH / wIn;
  const copCarnot = ev.T / (co.T - ev.T);

  const domeTS = [
    ...R134A_SAT.map(r => [r[6], r[0] + 273.15]),
    ...R134A_SAT.slice(0, -1).reverse().map(r => [r[7], r[0] + 273.15]),
  ];
  const domePV = [
    ...R134A_SAT.map(r => [r[2], r[1]]),
    ...R134A_SAT.slice(0, -1).reverse().map(r => [r[3], r[1]]),
  ];
  const ts = [[s1, T1], [s2, T2], [co.sg, co.T], [s3, T3], [s4, T4], [s1, T1]];
  const pv = [[v1, ev.P], [v2, co.P], [co.vg, co.P], [v3, co.P], [v4, ev.P], [v1, ev.P]];

  return {
    type: 'vcr', isRefrig: true, qL, qH, wIn, copR, copHP, copCarnot, x4,
    states: [
      { id: 1, T: T1, P: ev.P, v: v1, h: h1, s: s1, x: 1 },
      { id: 2, T: T2, P: co.P, v: v2, h: h2, s: s2, x: null },
      { id: 3, T: T3, P: co.P, v: v3, h: h3, s: s3, x: 0 },
      { id: 4, T: T4, P: ev.P, v: v4, h: h4, s: s4, x: x4 },
    ],
    pv, ts, domePV, domeTS,
  };
}

// =====================================================================
// 10. İDEAL GAZ & KİNETİK TEORİ (Processes & Maxwell-Boltzmann)
// =====================================================================

export const GAS_SPECIES = {
  he:  { name: 'Helyum (He, tek atomlu)',  M: 0.0040026, gamma: 5 / 3 },
  n2:  { name: 'Azot (N₂, iki atomlu)',    M: 0.0280134, gamma: 7 / 5 },
  o2:  { name: 'Oksijen (O₂, iki atomlu)', M: 0.0319988, gamma: 7 / 5 },
  co2: { name: 'CO₂ (çok atomlu)',         M: 0.0440095, gamma: 4 / 3 },
};

/**
 * 3D Maxwell-Boltzmann speed distribution f(v) [s/m] & characteristic speeds [m/s].
 */
export function maxwellBoltzmann(T, M, vMax = null, n = 220) {
  const vp = Math.sqrt((2 * R_UNIV * T) / M);
  const vMean = Math.sqrt((8 * R_UNIV * T) / (Math.PI * M));
  const vRms = Math.sqrt((3 * R_UNIV * T) / M);
  const hi = vMax ?? Math.max(vRms * 2.6, 1200);
  const coef = 4 * Math.PI * Math.pow(M / (2 * Math.PI * R_UNIV * T), 1.5);
  const vs = [], pdf = [];
  for (let i = 0; i <= n; i++) {
    const v = (hi * i) / n;
    vs.push(v);
    pdf.push(coef * v * v * Math.exp((-M * v * v) / (2 * R_UNIV * T)));
  }
  return { vp, vMean, vRms, vs, pdf };
}

/**
 * Ideal gas thermodynamic process from (P1, V1, T1) to V2 (or T2 for isochoric).
 * Units: n [mol], T [K], V [m^3], P [Pa], W/Q/dU [J].
 */
export function idealGasProcess({ process = 'isothermal', nMol = 1, T1 = 300, V1 = 0.025, V2 = 0.05, T2Isochoric = 500, gamma = 1.4, nPts = 80 }) {
  const Cv = R_UNIV / (gamma - 1);
  const Cp = (gamma * R_UNIV) / (gamma - 1);
  const P1 = (nMol * R_UNIV * T1) / V1;
  let P2, T2, Vf = V2, W = 0, dU = 0, Q = 0, dS = 0;
  const vs = [], ps = [];

  if (process === 'isothermal') {
    T2 = T1;
    P2 = (P1 * V1) / V2;
    W = nMol * R_UNIV * T1 * Math.log(V2 / V1);
    dU = 0;
    Q = W;
    dS = nMol * R_UNIV * Math.log(V2 / V1);
    for (let i = 0; i <= nPts; i++) {
      const V = V1 + ((V2 - V1) * i) / nPts;
      vs.push(V); ps.push((P1 * V1) / V);
    }
  } else if (process === 'adiabatic') {
    T2 = T1 * Math.pow(V1 / V2, gamma - 1);
    P2 = P1 * Math.pow(V1 / V2, gamma);
    dU = nMol * Cv * (T2 - T1);
    Q = 0;
    W = -dU; // = (P1*V1 - P2*V2)/(gamma - 1)
    dS = 0;
    for (let i = 0; i <= nPts; i++) {
      const V = V1 + ((V2 - V1) * i) / nPts;
      vs.push(V); ps.push(P1 * Math.pow(V1 / V, gamma));
    }
  } else if (process === 'isobaric') {
    P2 = P1;
    T2 = T1 * (V2 / V1);
    W = P1 * (V2 - V1);
    dU = nMol * Cv * (T2 - T1);
    Q = nMol * Cp * (T2 - T1);
    dS = nMol * Cp * Math.log(T2 / T1);
    for (let i = 0; i <= nPts; i++) {
      const V = V1 + ((V2 - V1) * i) / nPts;
      vs.push(V); ps.push(P1);
    }
  } else {
    // isochoric
    Vf = V1;
    T2 = T2Isochoric;
    P2 = P1 * (T2 / T1);
    W = 0;
    dU = nMol * Cv * (T2 - T1);
    Q = dU;
    dS = nMol * Cv * Math.log(T2 / T1);
    for (let i = 0; i <= nPts; i++) {
      const P = P1 + ((P2 - P1) * i) / nPts;
      vs.push(V1); ps.push(P);
    }
  }

  return { P1, V1, T1, P2, V2: Vf, T2, W, dU, Q, dS, vs, ps };
}

// =====================================================================
// 11. ISI İLETİMİ (1D Transient FTCS, 2D Steady Laplace, Composite Wall)
// =====================================================================

/**
 * Single explicit FTCS step for 1D heat equation dT/dt = alpha * d2T/dx2.
 * Returns { T, Fo, stable }.
 */
export function heat1DStep(T, { alpha, dx, dt, TL, TR }) {
  const Fo = (alpha * dt) / (dx * dx);
  const stable = Fo <= 0.5 + 1e-12;
  const n = T.length;
  const next = new Float64Array(n);
  next[0] = TL;
  next[n - 1] = TR;
  for (let i = 1; i < n - 1; i++) {
    const val = T[i] + Fo * (T[i - 1] - 2 * T[i] + T[i + 1]);
    next[i] = clamp(val, -5000, 10000); // prevent NaN blowup if user deliberately violates stability
  }
  return { T: next, Fo, stable };
}

/** Initialize 1D rod temperature field for a preset profile. */
export function heat1DInit({ N = 41, TL = 100, TR = 20, T0 = 20, profile = 'uniform' }) {
  const T = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    if (profile === 'sine') {
      T[i] = TL + (TR - TL) * u + 80 * Math.sin(Math.PI * u);
    } else if (profile === 'pulse') {
      T[i] = T0 + 140 * Math.exp(-Math.pow((u - 0.5) / 0.12, 2));
    } else {
      T[i] = T0;
    }
  }
  T[0] = TL;
  T[N - 1] = TR;
  return T;
}

/**
 * 2D steady Laplace equation (d2T/dx2 + d2T/dy2 = 0) on N x N plate via SOR.
 */
export function solveLaplace2D({ N = 25, Ttop = 100, Tbottom = 20, Tleft = 40, Tright = 40, maxIter = 800, tol = 1e-5 }) {
  const grid = Array.from({ length: N }, () => new Float64Array(N));
  const avg = 0.25 * (Ttop + Tbottom + Tleft + Tright);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) grid[r][c] = avg;
  }
  for (let c = 0; c < N; c++) { grid[0][c] = Ttop; grid[N - 1][c] = Tbottom; }
  for (let r = 0; r < N; r++) { grid[r][0] = Tleft; grid[r][N - 1] = Tright; }
  // Average corners for smooth contours
  grid[0][0] = 0.5 * (Ttop + Tleft);
  grid[0][N - 1] = 0.5 * (Ttop + Tright);
  grid[N - 1][0] = 0.5 * (Tbottom + Tleft);
  grid[N - 1][N - 1] = 0.5 * (Tbottom + Tright);

  const omega = 2 / (1 + Math.sin(Math.PI / N)); // optimal SOR relaxation factor
  let iters = 0, maxDiff = Infinity;
  for (iters = 0; iters < maxIter; iters++) {
    maxDiff = 0;
    for (let r = 1; r < N - 1; r++) {
      for (let c = 1; c < N - 1; c++) {
        const gs = 0.25 * (grid[r - 1][c] + grid[r + 1][c] + grid[r][c - 1] + grid[r][c + 1]);
        const next = grid[r][c] + omega * (gs - grid[r][c]);
        const d = Math.abs(next - grid[r][c]);
        if (d > maxDiff) maxDiff = d;
        grid[r][c] = next;
      }
    }
    if (maxDiff < tol) break;
  }
  const Tcenter = grid[(N - 1) >> 1][(N - 1) >> 1];
  return { grid, N, iters, maxDiff, Tcenter };
}

/**
 * Composite planar wall thermal resistance network:
 *   Tin --(hi)--> [L1,k1] -- [L2,k2] -- [L3,k3] --(ho)--> Tout
 */
export function solveCompositeWall({ Tin = 22, Tout = -5, hi = 10, ho = 25, A = 1, layers }) {
  const RconvI = 1 / (hi * A);
  const RconvO = 1 / (ho * A);
  const Rlayers = layers.map(l => l.L / (l.k * A));
  const Rtot = RconvI + Rlayers.reduce((a, b) => a + b, 0) + RconvO;
  const Q = (Tin - Tout) / Rtot;      // W
  const qFlux = Q / A;                // W/m^2
  const U = 1 / (Rtot * A);           // W/(m^2·K)

  const temps = [Tin];
  let curT = Tin - Q * RconvI;
  temps.push(curT); // inner surface
  for (const Rl of Rlayers) {
    curT -= Q * Rl;
    temps.push(curT);
  }
  temps.push(Tout);
  return { RconvI, RconvO, Rlayers, Rtot, Q, qFlux, U, temps };
}

// =====================================================================
// 12. KANATÇIK & ISI DEĞİŞTİRİCİ (Fins & Heat Exchangers)
// =====================================================================

/**
 * Extended surface (fin) analytical solution.
 * tip: 'adiabatic' | 'convective' | 'infinite'
 */
export function solveFin({ L = 0.08, t = 0.004, w = 0.05, k = 180, h = 45, Tb = 120, Tinf = 25, tip = 'adiabatic', n = 100 }) {
  const P = 2 * (w + t);
  const Ac = w * t;
  const m = Math.sqrt((h * P) / (k * Ac));
  const mL = m * L;
  const thetaB = Tb - Tinf;
  const M = Math.sqrt(h * P * k * Ac) * thetaB;
  const H = h / (m * k);

  let qFin, eta, tipTemp;
  const xs = [], Ts = [];
  const Af = P * L + (tip === 'convective' ? Ac : 0);

  if (tip === 'infinite') {
    qFin = M;
    eta = 1 / Math.max(mL, 1e-9);
    for (let i = 0; i <= n; i++) {
      const x = (L * i) / n;
      xs.push(x);
      Ts.push(Tinf + thetaB * Math.exp(-m * x));
    }
    tipTemp = Ts[n];
  } else if (tip === 'convective') {
    const sh = Math.sinh(mL), ch = Math.cosh(mL);
    const den = ch + H * sh;
    qFin = M * ((sh + H * ch) / den);
    eta = qFin / (h * Af * thetaB);
    for (let i = 0; i <= n; i++) {
      const x = (L * i) / n;
      const mx = m * (L - x);
      xs.push(x);
      Ts.push(Tinf + thetaB * ((Math.cosh(mx) + H * Math.sinh(mx)) / den));
    }
    tipTemp = Ts[n];
  } else {
    // Adiabatic tip
    const ch = Math.cosh(mL);
    qFin = M * Math.tanh(mL);
    eta = mL > 1e-9 ? Math.tanh(mL) / mL : 1;
    for (let i = 0; i <= n; i++) {
      const x = (L * i) / n;
      xs.push(x);
      Ts.push(Tinf + thetaB * (Math.cosh(m * (L - x)) / ch));
    }
    tipTemp = Ts[n];
  }

  const effectiveness = thetaB !== 0 ? qFin / (h * Ac * thetaB) : 0;
  return { P, Ac, m, mL, qFin, eta, effectiveness, tipTemp, xs, Ts };
}

/**
 * Parallel-flow or Counter-flow Heat Exchanger: exact epsilon-NTU & LMTD & axial T(x) profiles.
 */
export function solveHeatExchanger({ flow = 'counter', Ch = 4000, Cc = 3000, Thi = 140, Tci = 25, UA = 2500, n = 80 }) {
  const Cmin = Math.min(Ch, Cc);
  const Cmax = Math.max(Ch, Cc);
  const Cr = Cmin / Cmax;
  const NTU = UA / Cmin;

  let eps;
  if (flow === 'parallel') {
    eps = (1 - Math.exp(-NTU * (1 + Cr))) / (1 + Cr);
  } else {
    if (Math.abs(1 - Cr) < 1e-6) {
      eps = NTU / (1 + NTU);
    } else {
      const e = Math.exp(-NTU * (1 - Cr));
      eps = (1 - e) / (1 - Cr * e);
    }
  }

  const Qmax = Cmin * (Thi - Tci);
  const Q = eps * Qmax;
  const Tho = Thi - Q / Ch;
  const Tco = Tci + Q / Cc;

  // LMTD check
  const dT1 = flow === 'parallel' ? (Thi - Tci) : (Thi - Tco);
  const dT2 = flow === 'parallel' ? (Tho - Tco) : (Tho - Tci);
  const lmtd = Math.abs(dT1 - dT2) < 1e-6 * Math.max(1, Math.abs(dT1))
    ? 0.5 * (dT1 + dT2)
    : (dT1 - dT2) / Math.log(dT1 / dT2);

  // Exact axial temperature profiles along x in [0, 1]
  const xs = [], ThArr = [], TcArr = [];
  if (flow === 'parallel') {
    const beta = UA * (1 / Ch + 1 / Cc);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const e = Math.exp(-beta * u);
      const qFrac = (1 - e) / (1 + Ch / Cc);
      const Th = Thi - (Thi - Tci) * (1 - e) / (1 + Ch / Cc);
      const Tc = Tci + (Ch / Cc) * (Thi - Th);
      xs.push(u); ThArr.push(Th); TcArr.push(Tc);
    }
  } else {
    // Counter-flow: hot enters at u=0, cold enters at u=1 (exits at u=0)
    const a = UA * (1 / Ch - 1 / Cc);
    const dT0 = Thi - Tco;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let Th, Tc;
      if (Math.abs(a) < 1e-6) {
        Th = Thi - (Q / Ch) * u;
        Tc = Tco - (Q / Cc) * u;
      } else {
        const dTu = dT0 * Math.exp(-a * u);
        // Th(u) - Tc(u) = dTu and Ch*(Thi - Th(u)) = Cc*(Tco - Tc(u))
        const ratio = Ch / Cc;
        // Tc(u) = Tco - ratio*(Thi - Th(u)) -> Th(u)*(1 - ratio) = dTu + Tco - ratio*Thi
        Th = (dTu + Tco - ratio * Thi) / (1 - ratio);
        Tc = Th - dTu;
      }
      xs.push(u); ThArr.push(Th); TcArr.push(Tc);
    }
  }

  return { Cmin, Cmax, Cr, NTU, eps, Qmax, Q, Tho, Tco, dT1, dT2, lmtd, xs, Th: ThArr, Tc: TcArr };
}

// =====================================================================
// 13. BORU AKIŞI, MOODY, POMPA-SİSTEM & VENTURİ
// =====================================================================

/**
 * Darcy friction factor via exact laminar (64/Re) and Colebrook-White (Newton-Raphson) for turbulent.
 */
export function colebrookFriction(Re, relRough = 0.0002) {
  if (Re <= 0) return 0;
  if (Re < 2300) return 64 / Re;
  const rr = Math.max(0, relRough);
  // Haaland explicit initial guess
  const invSqrt0 = -1.8 * Math.log10(Math.pow(rr / 3.7, 1.11) + 6.9 / Re);
  let x = Math.max(invSqrt0, 1); // x = 1 / sqrt(f)
  const ln10 = Math.LN10;
  for (let i = 0; i < 12; i++) {
    const arg = rr / 3.7 + (2.51 * x) / Re;
    const g = x + 2 * Math.log10(arg);
    const dg = 1 + (2 * 2.51) / (Re * arg * ln10);
    const dx = g / dg;
    x -= dx;
    if (Math.abs(dx) < 1e-12) break;
  }
  return 1 / (x * x);
}

/**
 * Pipe flow hydraulics: Reynolds, regime, Colebrook f, Darcy-Weisbach major + minor losses, velocity profile.
 */
export function solvePipeFlow({
  D = 0.1, L = 100, V = 2.0, rho = 998, mu = 1.002e-3,
  roughness = 0.000045, sumK = 2.5,
}) {
  const A = (Math.PI / 4) * D * D;
  const Q = V * A;
  const Re = (rho * V * D) / mu;
  const relRough = roughness / D;
  const regime = Re < 2300 ? 'Laminer' : Re <= 4000 ? 'Geçiş' : 'Türbülanslı';
  const f = Re < 2300 ? 64 / Math.max(Re, 1)
    : Re <= 4000
      ? (64 / 2300) + ((Re - 2300) / 1700) * (colebrookFriction(4000, relRough) - 64 / 2300)
      : colebrookFriction(Re, relRough);

  const hf = f * (L / D) * ((V * V) / (2 * G0));
  const hm = sumK * ((V * V) / (2 * G0));
  const hTotal = hf + hm;
  const dP = rho * G0 * hTotal;
  const tauWall = (f / 8) * rho * V * V;
  const pPower = Q * dP;

  // Normalized velocity profile u(r/R) / V
  const isLam = Re < 2300;
  const nPow = isLam ? 1 : clamp(5.5 + 0.5 * Math.log10(Math.max(4000, Re)), 6, 10);
  const vMaxRatio = isLam ? 2.0 : ((nPow + 1) * (2 * nPow + 1)) / (2 * nPow * nPow);
  const profile = [];
  for (let i = -30; i <= 30; i++) {
    const rNorm = i / 30;
    const a = Math.abs(rNorm);
    const uNorm = isLam ? 2 * (1 - a * a) : vMaxRatio * Math.pow(Math.max(0, 1 - a), 1 / nPow);
    profile.push({ rNorm, uOverV: uNorm });
  }
  return { A, Q, Re, relRough, regime, f, hf, hm, hTotal, dP, tauWall, pPower, vMaxRatio, profile };
}

/**
 * Find Pump vs System curve operating point:
 *   H_pump(Q) = H0 - a * Q^2
 *   H_sys(Q)  = dZ + (f(Q)*L/D + sumK) * (Q/A)^2 / (2g)
 */
export function solvePumpSystem({ H0 = 45, aPump = 800, dZ = 12, D = 0.12, L = 200, roughness = 0.00015, sumK = 4, rho = 998, mu = 1.002e-3, etaP = 0.78 }) {
  const A = (Math.PI / 4) * D * D;
  const hSys = Q => {
    const V = Q / A;
    const Re = (rho * V * D) / mu;
    const f = Re > 1 ? colebrookFriction(Math.max(Re, 1), roughness / D) : 0;
    return dZ + (f * (L / D) + sumK) * ((V * V) / (2 * G0));
  };
  const hPump = Q => H0 - aPump * Q * Q;
  const qMax = Math.sqrt(Math.max(0, H0 / aPump));

  let lo = 0, hi = qMax;
  const feasible = H0 > dZ;
  if (feasible) {
    for (let i = 0; i < 48; i++) {
      const mid = 0.5 * (lo + hi);
      if (hPump(mid) > hSys(mid)) lo = mid; else hi = mid;
    }
  }
  const Qop = feasible ? 0.5 * (lo + hi) : 0;
  const Hop = feasible ? hPump(Qop) : dZ;
  const Vop = Qop / A;
  const pHyd = rho * G0 * Qop * Hop;
  const pShaft = pHyd / etaP;

  const qs = [], hp = [], hs = [];
  for (let i = 0; i <= 80; i++) {
    const q = (qMax * i) / 80;
    qs.push(q);
    hp.push(Math.max(0, hPump(q)));
    hs.push(hSys(q));
  }
  return { feasible, Qop, Hop, Vop, pHyd, pShaft, qMax, qs, hp, hs };
}

/** Bernoulli / Venturi meter calculation. */
export function solveVenturi({ D1 = 0.12, D2 = 0.06, Q = 0.025, rho = 998, rhoMano = 13600, Cd = 0.98 }) {
  const A1 = (Math.PI / 4) * D1 * D1;
  const A2 = (Math.PI / 4) * D2 * D2;
  const beta = D2 / D1;
  const V1 = Q / A1;
  const V2 = Q / A2;
  const dP = 0.5 * rho * (V2 * V2 - V1 * V1) / (Cd * Cd);
  const dHWater = dP / (rho * G0);
  const dHMano = dP / (Math.max(1, rhoMano - rho) * G0);
  return { A1, A2, beta, V1, V2, dP, dHWater, dHMano };
}

// =====================================================================
// 14. POTANSİYEL AKIŞ & KUTTA-JOUKOWSKI (2D Potential Flow)
// =====================================================================

/**
 * Evaluate 2D potential flow velocity (u, v), stream function psi, potential phi, and Cp
 * for a superposition of elementary flows.
 * Elements:
 *   { type: 'uniform', U, alpha } (alpha rad)
 *   { type: 'source', m, x, y }   (m>0 source, m<0 sink)
 *   { type: 'doublet', kappa, x, y, alpha } (kappa = 2*pi*U*R^2 gives cylinder of radius R)
 *   { type: 'vortex', gamma, x, y } (gamma > 0 clockwise -> upward Kutta-Joukowski lift L' = rho*U*gamma)
 */
export function evalPotentialFlow(x, y, elements, Uref = 1) {
  let u = 0, v = 0, psi = 0, phi = 0;
  const eps2 = 1e-6;
  for (const el of elements) {
    if (el.type === 'uniform') {
      const ca = Math.cos(el.alpha || 0), sa = Math.sin(el.alpha || 0);
      u += el.U * ca;
      v += el.U * sa;
      psi += el.U * (y * ca - x * sa);
      phi += el.U * (x * ca + y * sa);
    } else if (el.type === 'source') {
      const dx = x - el.x, dy = y - el.y;
      const r2 = dx * dx + dy * dy + eps2;
      const c = el.m / (2 * Math.PI);
      u += (c * dx) / r2;
      v += (c * dy) / r2;
      psi += c * Math.atan2(dy, dx);
      phi += 0.5 * c * Math.log(r2);
    } else if (el.type === 'doublet') {
      const dx = x - el.x, dy = y - el.y;
      const r2 = dx * dx + dy * dy + eps2;
      const r4 = r2 * r2;
      const c = el.kappa / (2 * Math.PI);
      u += (-c * (dx * dx - dy * dy)) / r4;
      v += (-c * 2 * dx * dy) / r4;
      psi += (-c * dy) / r2;
      phi += (c * dx) / r2;
    } else if (el.type === 'vortex') {
      const dx = x - el.x, dy = y - el.y;
      const r2 = dx * dx + dy * dy + eps2;
      const c = el.gamma / (2 * Math.PI);
      // Clockwise positive Gamma -> u = +c*dy/r2, v = -c*dx/r2, psi = +c*ln(r)
      u += (c * dy) / r2;
      v += (-c * dx) / r2;
      psi += 0.5 * c * Math.log(r2);
      phi += -c * Math.atan2(dy, dx);
    }
  }
  const speed2 = u * u + v * v;
  const U2 = Math.max(1e-9, Uref * Uref);
  const Cp = 1 - speed2 / U2;
  return { u, v, speed: Math.sqrt(speed2), psi, phi, Cp };
}

/**
 * Analytical cylinder with circulation (Kutta-Joukowski lift & stagnation points).
 */
export function cylinderWithCirculation({ U = 10, R = 1, gamma = 25, rho = 1.225 }) {
  const kappa = 2 * Math.PI * U * R * R;
  const liftPerSpan = rho * U * gamma; // N/m (Kutta-Joukowski theorem)
  const CL = gamma / (U * R);          // L' / (0.5*rho*U^2 * 2R) = (rho*U*gamma)/(rho*U^2*R) = gamma/(U*R)
  const gammaCrit = 4 * Math.PI * U * R;
  const ratio = gamma / gammaCrit;
  const stagPts = [];
  if (Math.abs(ratio) <= 1) {
    const th1 = Math.asin(-ratio);
    const th2 = Math.PI - th1;
    stagPts.push({ x: R * Math.cos(th1), y: R * Math.sin(th1), onSurface: true });
    if (Math.abs(ratio) < 0.999) {
      stagPts.push({ x: R * Math.cos(th2), y: R * Math.sin(th2), onSurface: true });
    }
  } else {
    // Detached stagnation point along y-axis (y < 0 for gamma > 0, y > 0 for gamma < 0)
    const sgn = gamma >= 0 ? -1 : 1;
    const yMag = R * (Math.abs(ratio) + Math.sqrt(ratio * ratio - 1));
    stagPts.push({ x: 0, y: sgn * yMag, onSurface: false });
  }
  // Surface Cp(theta) for theta in [0, 360]
  const degs = [], cps = [];
  for (let i = 0; i <= 180; i++) {
    const th = (2 * Math.PI * i) / 180;
    const vTheta = -2 * U * Math.sin(th) - gamma / (2 * Math.PI * R);
    degs.push(th * DEG);
    cps.push(1 - (vTheta * vTheta) / (U * U));
  }
  const elements = [
    { type: 'uniform', U, alpha: 0 },
    { type: 'doublet', kappa, x: 0, y: 0 },
    { type: 'vortex', gamma, x: 0, y: 0 },
  ];
  return { kappa, liftPerSpan, CL, gammaCrit, stagPts, degs, cps, elements };
}

// =====================================================================
// 15. AKIŞKAN STATİĞİ & KALDIRMA (Submerged Gate & Buoyancy Stability)
// =====================================================================

/**
 * Hydrostatic force & center of pressure on an inclined rectangular submerged gate.
 */
export function solveSubmergedGate({ b = 2.0, L = 3.0, thetaDeg = 60, hTop = 1.5, rho = 998, g = G0 }) {
  const th = clamp(thetaDeg, 10, 90) * RAD;
  const sinT = Math.sin(th);
  const A = b * L;
  const hc = hTop + 0.5 * L * sinT;
  const yc = hc / sinT;
  const Ixc = (b * Math.pow(L, 3)) / 12;
  const yP = yc + Ixc / (yc * A);
  const hP = yP * sinT;
  const eP = yP - yc; // distance below centroid along gate
  const FR = rho * g * hc * A;
  const pTop = rho * g * hTop;
  const pBot = rho * g * (hTop + L * sinT);
  // Hinge moment about top edge
  const momentTop = FR * (L / 2 + eP);
  const momentBot = FR * (L / 2 - eP);
  return { A, hc, yc, Ixc, yP, hP, eP, FR, pTop, pBot, momentTop, momentBot };
}

/**
 * Floating rectangular hull buoyancy and metacentric height stability.
 */
export function solveBuoyancyStability({ B = 6.0, H = 3.0, L = 12.0, relDensity = 0.55, kgRatio = 0.5, rhoFluid = 1025, heelDeg = 10, g = G0 }) {
  const s = clamp(relDensity, 0.05, 0.98);
  const draft = s * H;
  const freeboard = H - draft;
  const volSub = B * L * draft;
  const mass = rhoFluid * volSub;
  const weight = mass * g;
  const KB = 0.5 * draft;
  const Iw = (L * Math.pow(B, 3)) / 12;
  const BM = Iw / volSub; // = B^2 / (12 * draft)
  const KG = clamp(kgRatio, 0.1, 1.2) * H;
  const GM = KB + BM - KG;
  const stable = GM > 1e-4;
  const neutral = Math.abs(GM) <= 1e-4;
  const heel = heelDeg * RAD;
  // Wall-sided exact righting arm GZ = sin(phi) * (GM + 0.5*BM*tan^2(phi)) for small-to-moderate heel
  const tanH = Math.tan(heel);
  const GZ = Math.sin(heel) * (GM + 0.5 * BM * tanH * tanH);
  const rightingMoment = weight * GZ;
  const status = stable ? 'Kararlı (GM > 0)' : neutral ? 'Nötr (GM ≈ 0)' : 'Kararsız / Alabora (GM < 0)';
  return { draft, freeboard, volSub, mass, weight, KB, Iw, BM, KG, GM, GZ, rightingMoment, stable, status };
}

// =====================================================================
// 16. ISI IŞINIMI (Planck, Wien, Stefan-Boltzmann, View Factor)
// =====================================================================

/** Planck blackbody spectral emissive power E_{b,lambda}(lambda_m, T_K) [W / m^3]. */
export function planckSpectral(lambdaM, T) {
  if (lambdaM <= 0 || T <= 0) return 0;
  const expo = PLANCK_C2 / (lambdaM * T);
  if (expo > 700) return 0;
  return PLANCK_C1 / (Math.pow(lambdaM, 5) * (Math.exp(expo) - 1));
}

/**
 * Full blackbody summary: Wien peak wavelength [um], Stefan-Boltzmann total power [W/m^2],
 * UV/Visible/IR energy fractions via numerical integration, and spectral curve [W/(m^2·um)].
 */
export function blackbodySummary(T, eps = 1.0) {
  const lambdaMaxUm = (WIEN_B / T) * 1e6;
  const EbTotal = SIGMA_SB * Math.pow(T, 4);
  const EReal = eps * EbTotal;

  // Spectral band fractions via Gauss/midpoint quadrature in log-lambda from 0.05 um to 200 um
  const integrateBand = (umA, umB, steps = 200) => {
    const la = Math.log(umA * 1e-6), lb = Math.log(umB * 1e-6);
    const dl = (lb - la) / steps;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      const lam = Math.exp(la + (i + 0.5) * dl);
      sum += planckSpectral(lam, T) * lam * dl; // d(lam) = lam * d(ln lam)
    }
    return sum;
  };
  const eUV = integrateBand(0.02, 0.38, 120);
  const eVis = integrateBand(0.38, 0.75, 160);
  const fUV = clamp(eUV / EbTotal, 0, 1);
  const fVis = clamp(eVis / EbTotal, 0, 1);
  const fIR = clamp(1 - fUV - fVis, 0, 1);

  const lamsUm = [], Evals = [];
  const n = 220;
  const lo = Math.log10(0.1), hi = Math.log10(30);
  for (let i = 0; i <= n; i++) {
    const um = Math.pow(10, lo + ((hi - lo) * i) / n);
    lamsUm.push(um);
    // W/(m^2·um) = W/m^3 * 1e-6
    Evals.push(eps * planckSpectral(um * 1e-6, T) * 1e-6);
  }
  return { T, eps, lambdaMaxUm, EbTotal, EReal, fUV, fVis, fIR, lamsUm, Evals };
}

/**
 * Exact view factor F12 between two aligned parallel rectangular plates (width W, height H, separation L).
 */
export function viewFactorParallelPlates(W, H, L) {
  const X = W / Math.max(L, 1e-9);
  const Y = H / Math.max(L, 1e-9);
  const X2 = X * X, Y2 = Y * Y;
  const sX = Math.sqrt(1 + X2), sY = Math.sqrt(1 + Y2);
  const term1 = 0.5 * Math.log(((1 + X2) * (1 + Y2)) / (1 + X2 + Y2));
  const term2 = X * sY * Math.atan(X / sY);
  const term3 = Y * sX * Math.atan(Y / sX);
  const term4 = -X * Math.atan(X) - Y * Math.atan(Y);
  const F12 = (2 / (Math.PI * X * Y)) * (term1 + term2 + term3 + term4);
  return clamp(F12, 0, 1);
}

/** Net gray-surface radiation heat exchange between two aligned parallel plates [W]. */
export function radiationPlateExchange({ W = 1, H = 1, L = 0.5, T1 = 800, T2 = 300, eps1 = 0.85, eps2 = 0.85 }) {
  const A = W * H;
  const F12 = viewFactorParallelPlates(W, H, L);
  const R1 = (1 - eps1) / (eps1 * A);
  const R12 = 1 / Math.max(1e-12, A * F12);
  const R2 = (1 - eps2) / (eps2 * A);
  const Rtot = R1 + R12 + R2;
  const Q12 = (SIGMA_SB * (Math.pow(T1, 4) - Math.pow(T2, 4))) / Rtot;
  return { A, F12, R1, R12, R2, Rtot, Q12 };
}

// =====================================================================
// 17. YÖRÜNGE MEKANİĞİ (Two-Body Orbit, Kepler Elements, Hohmann)
// =====================================================================

/**
 * Classical 2D orbital elements from state (x, y, vx, vy) around central body (mu, Rbody).
 */
export function orbitalElements({ x, y, vx, vy, mu = MU_EARTH, Rbody = R_EARTH }) {
  const r = Math.hypot(x, y);
  const v = Math.hypot(vx, vy);
  const h = x * vy - y * vx; // specific angular momentum (z-component)
  const eps = 0.5 * v * v - mu / r; // specific orbital energy
  const rdotv = x * vx + y * vy;

  // Eccentricity vector e = ((v^2 - mu/r)r - (r·v)v) / mu
  const ex = ((v * v - mu / r) * x - rdotv * vx) / mu;
  const ey = ((v * v - mu / r) * y - rdotv * vy) / mu;
  const e = Math.hypot(ex, ey);
  const omegaP = Math.atan2(ey, ex);

  const p = (h * h) / mu; // semi-latus rectum
  const isParabolic = Math.abs(e - 1) < 1e-4;
  const a = isParabolic ? Infinity : -mu / (2 * eps);
  const rp = e < 1e-9 ? r : p / (1 + e);
  const ra = e < 1 - 1e-4 ? p / (1 - e) : Infinity;
  const period = e < 1 - 1e-4 && a > 0 ? 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu) : Infinity;
  const vCirc = Math.sqrt(mu / r);
  const vEsc = Math.sqrt((2 * mu) / r);
  const impact = rp < Rbody;

  const orbitType = e < 0.01 ? 'Dairesel'
    : e < 1 - 1e-4 ? 'Eliptik'
    : isParabolic ? 'Parabolik (Kaçış)'
    : 'Hiperbolik';

  return { r, v, h, eps, ex, ey, e, omegaP, p, a, rp, ra, period, vCirc, vEsc, impact, orbitType };
}

/** RK4 step for 2-body planar gravity: state = [x, y, vx, vy]. */
export function orbitStep(state, dt, mu = MU_EARTH) {
  const deriv = (_t, [x, y, vx, vy]) => {
    const r2 = x * x + y * y;
    const r3 = Math.max(1e6, r2 * Math.sqrt(r2));
    return [vx, vy, (-mu * x) / r3, (-mu * y) / r3];
  };
  return rk4Step(deriv, 0, state, dt);
}

/** Hohmann transfer between two circular coplanar orbits of altitude h1, h2 [m]. */
export function hohmannTransfer({ h1 = 400e3, h2 = 35786e3, mu = MU_EARTH, Rbody = R_EARTH }) {
  const r1 = Rbody + h1;
  const r2 = Rbody + h2;
  const aT = 0.5 * (r1 + r2);
  const eT = Math.abs(r2 - r1) / (r1 + r2);
  const vc1 = Math.sqrt(mu / r1);
  const vc2 = Math.sqrt(mu / r2);
  const vt1 = Math.sqrt(mu * (2 / r1 - 1 / aT));
  const vt2 = Math.sqrt(mu * (2 / r2 - 1 / aT));
  const dv1 = Math.abs(vt1 - vc1);
  const dv2 = Math.abs(vc2 - vt2);
  const dvTotal = dv1 + dv2;
  const tTransfer = Math.PI * Math.sqrt(Math.pow(aT, 3) / mu);
  const T1 = 2 * Math.PI * Math.sqrt(Math.pow(r1, 3) / mu);
  const T2 = 2 * Math.PI * Math.sqrt(Math.pow(r2, 3) / mu);
  return { r1, r2, aT, eT, vc1, vc2, vt1, vt2, dv1, dv2, dvTotal, tTransfer, T1, T2 };
}

// =====================================================================
// 18. ROKET DENKLEMİ & DİKEY FIRLATMA (Tsiolkovsky, Multistage, Max-Q)
// =====================================================================

/**
 * International Standard Atmosphere (ISA) model from 0 to 85 km.
 * Exact ICAO layers: 0–11 km troposphere, 11–20 km lower stratosphere, 20–32 km, 32–47 km, 47–85 km.
 */
export function isaAtmosphere(altM) {
  const h = clamp(altM, 0, 85000);
  // Layer base values [h_b, T_b (K), L (K/m), P_b (Pa)]
  const layers = [
    [0,     288.15, -0.0065, 101325.0],
    [11000, 216.65,  0.0,     22632.06],
    [20000, 216.65,  0.001,    5474.889],
    [32000, 228.65,  0.0028,    868.0187],
    [47000, 270.65,  0.0,       110.9063],
    [51000, 270.65, -0.0028,     66.93887],
    [71000, 214.65, -0.002,       3.95642],
  ];
  let idx = 0;
  while (idx < layers.length - 1 && h >= layers[idx + 1][0]) idx++;
  const [hb, Tb, L, Pb] = layers[idx];
  const dh = h - hb;
  const T = Tb + L * dh;
  let P;
  if (Math.abs(L) < 1e-12) {
    P = Pb * Math.exp((-G0 * dh) / (R_AIR * Tb));
  } else {
    P = Pb * Math.pow(T / Tb, -G0 / (R_AIR * L));
  }
  const rho = P / (R_AIR * T);
  const a = Math.sqrt(1.4 * R_AIR * T);
  return { h, T, T_C: T - 273.15, P, rho, a };
}

/**
 * Tsiolkovsky multistage rocket Δv calculator.
 * stages: [{ mProp, mStruct, Isp }] ordered 1st stage -> upper stage, plus mPayload [kg].
 */
export function solveMultistageRocket({ stages, mPayload = 1000 }) {
  let mAbove = mPayload;
  const results = new Array(stages.length);
  let totalDv = 0;
  let totalProp = 0, totalStruct = 0;

  for (let i = stages.length - 1; i >= 0; i--) {
    const st = stages[i];
    const m0 = mAbove + st.mStruct + st.mProp;
    const mf = mAbove + st.mStruct;
    const ve = st.Isp * G0;
    const MR = m0 / mf;
    const dv = ve * Math.log(MR);
    const epsStruct = st.mStruct / Math.max(1e-9, st.mStruct + st.mProp);
    results[i] = { stage: i + 1, m0, mf, MR, ve, dv, epsStruct, mProp: st.mProp, mStruct: st.mStruct, Isp: st.Isp };
    totalDv += dv;
    totalProp += st.mProp;
    totalStruct += st.mStruct;
    mAbove = m0;
  }

  const mTotal = mPayload + totalProp + totalStruct;
  const payloadFrac = mPayload / mTotal;
  // Equivalent SSTO using mass-averaged Isp and combined structural mass
  const avgIsp = stages.reduce((s, st) => s + st.Isp * st.mProp, 0) / Math.max(1, totalProp);
  const sstoDv = avgIsp * G0 * Math.log(mTotal / (mPayload + totalStruct));
  return { stages: results, totalDv, sstoDv, mTotal, totalProp, totalStruct, payloadFrac };
}

/**
 * Vertical 1D rocket launch trajectory with ISA drag, altitude-varying gravity, staging, and Max-Q tracking.
 */
export function simulateVerticalLaunch({
  m0 = 50000, mProp = 40000, Isp = 290, thrust = 850000,
  Cd = 0.35, area = 4.0, dt = 0.2, maxTime = 240,
}) {
  const mDry = Math.max(100, m0 - mProp);
  const ve = Isp * G0;
  const mDot = thrust / ve;
  const tBurn = mProp / mDot;
  const dvIdeal = ve * Math.log(m0 / mDry);

  const ts = [], hs = [], vs = [], qs = [], accs = [], masses = [];
  let h = 0, v = 0, m = m0;
  let gravLoss = 0, dragLoss = 0;
  let maxQ = 0, maxQTime = 0, maxQAlt = 0;
  let maxAlt = 0, vBurnout = 0, hBurnout = 0, burnoutRecorded = false;

  const evalState = (tCur, [hh, vv]) => {
    const burning = tCur < tBurn;
    const mm = burning ? Math.max(mDry, m0 - mDot * tCur) : mDry;
    const g = G0 * Math.pow(R_EARTH / (R_EARTH + Math.max(0, hh)), 2);
    const atm = isaAtmosphere(Math.max(0, hh));
    const q = 0.5 * atm.rho * vv * vv;
    const drag = q * Cd * area * (vv >= 0 ? 1 : -1);
    const F = burning ? thrust : 0;
    const a = (F - drag) / mm - g;
    return { mm, g, q, drag, a, burning };
  };

  let t = 0;
  while (t <= maxTime) {
    const info = evalState(t, [h, v]);
    ts.push(t); hs.push(h); vs.push(v); qs.push(info.q); accs.push(info.a / G0); masses.push(info.mm);
    if (info.q > maxQ) { maxQ = info.q; maxQTime = t; maxQAlt = h; }
    if (h > maxAlt) maxAlt = h;

    if (!burnoutRecorded && t >= tBurn) {
      burnoutRecorded = true;
      vBurnout = v;
      hBurnout = h;
    }
    if (t > tBurn && v < 0 && h <= 0) break;

    // RK4 step for [h, v]
    const deriv = (tt, st) => {
      const inf = evalState(tt, st);
      return [st[1], inf.a];
    };
    const next = rk4Step(deriv, t, [h, v], dt);
    if (t < tBurn) {
      const subDt = Math.min(dt, tBurn - t);
      const mid = evalState(t + 0.5 * subDt, [0.5 * (h + next[0]), 0.5 * (v + next[1])]);
      gravLoss += mid.g * subDt;
      dragLoss += (Math.abs(mid.drag) / mid.mm) * subDt;
    }
    h = next[0];
    v = next[1];
    m = info.mm;
    t += dt;
    if (t > tBurn && v <= 0 && h < maxAlt * 0.999) {
      // Stop shortly after apogee for crisp ascent telemetry
      if (t > tBurn + 25 && v < -50) break;
    }
  }

  return {
    ts, hs, vs, qs, accs, masses,
    tBurn, dvIdeal, vBurnout, hBurnout, maxAlt,
    gravLoss, dragLoss, maxQ, maxQTime, maxQAlt,
    twr0: thrust / (m0 * G0),
  };
}

// =====================================================================
// 19. KANAT PROFİLİ (NACA 4-Digit, Thin Airfoil, Stall, Drag Polar, ISA)
// =====================================================================

/** Parse 4-digit NACA code (e.g., '2412') into { m, p, t, code }. */
export function parseNaca4(codeStr) {
  const s = String(codeStr ?? '2412').replace(/\D/g, '').padStart(4, '0').slice(0, 4);
  const M = +s[0], P = +s[1], XX = +s.slice(2, 4);
  return {
    code: s,
    m: clamp(M, 0, 9) / 100,
    p: clamp(P, 0, 9) / 10,
    t: clamp(XX, 4, 30) / 100,
  };
}

/** Generate NACA 4-digit upper, lower & camber coordinates on cosine-clustered x in [0, 1]. */
export function generateNaca4({ m = 0.02, p = 0.4, t = 0.12 }, nPts = 80) {
  const upper = [], lower = [], camber = [];
  for (let i = 0; i <= nPts; i++) {
    // Cosine spacing gives sharp leading edge resolution
    const beta = (Math.PI * i) / nPts;
    const x = 0.5 * (1 - Math.cos(beta));
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
    let yc = 0, dyc = 0;
    if (m > 0 && p > 0 && p < 1) {
      if (x < p) {
        yc = (m / (p * p)) * (2 * p * x - x * x);
        dyc = ((2 * m) / (p * p)) * (p - x);
      } else {
        yc = (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
        dyc = ((2 * m) / ((1 - p) * (1 - p))) * (p - x);
      }
    }
    const th = Math.atan(dyc);
    upper.push({ x: x - yt * Math.sin(th), y: yc + yt * Math.cos(th) });
    lower.push({ x: x + yt * Math.sin(th), y: yc - yt * Math.cos(th) });
    camber.push({ x, y: yc, dyc });
  }
  return { upper, lower, camber };
}

/**
 * Exact thin-airfoil zero-lift angle alpha_L0 [rad] via Glauert cosine integral.
 */
export function thinAirfoilZeroLift(m, p) {
  if (m <= 1e-9 || p <= 1e-6 || p >= 1 - 1e-6) return 0;
  const N = 200;
  const dTh = Math.PI / N;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const th = (i + 0.5) * dTh;
    const x = 0.5 * (1 - Math.cos(th));
    const dyc = x < p
      ? ((2 * m) / (p * p)) * (p - x)
      : ((2 * m) / ((1 - p) * (1 - p))) * (p - x);
    sum += dyc * (Math.cos(th) - 1) * dTh;
  }
  return -sum / Math.PI;
}

/**
 * Evaluate airfoil / finite-wing aerodynamic coefficients & forces at (alphaDeg, V, altM, S, AR).
 */
export function evaluateAirfoil({ m = 0.02, p = 0.4, t = 0.12, alphaDeg = 4, V = 65, altM = 1000, S = 16, AR = 8, eOswald = 0.85, finiteWing = true }) {
  const alpha = alphaDeg * RAD;
  const alphaL0 = thinAirfoilZeroLift(m, p);
  const alphaL0Deg = alphaL0 * DEG;

  // Lift slope: 2*pi (2D) or lifting-line corrected 2*pi / (1 + 2/(e*AR))
  const a0 = 2 * Math.PI;
  const liftSlope = finiteWing ? a0 / (1 + a0 / (Math.PI * eOswald * AR)) : a0;

  // Stall angle depends on thickness & camber (typical 13°–17°)
  const alphaStallDeg = clamp(11.5 + 32 * t + 20 * m - (finiteWing ? 0 : 0.5), 11, 18);
  const alphaEffDeg = alphaDeg - alphaL0Deg;
  const clLinear = liftSlope * (alpha - alphaL0);

  // Smooth separation blending factor fSep in [0, 1] (0 = attached, 1 = fully stalled)
  const overStall = Math.abs(alphaDeg) - alphaStallDeg;
  const fSep = 1 / (1 + Math.exp(-0.55 * (overStall - 1.2)));
  const clFlatPlate = 2 * Math.sin(alpha) * Math.cos(alpha);
  const CL = (1 - fSep) * clLinear + fSep * clFlatPlate * 0.92;

  // Drag polar: profile drag (increases with thickness) + induced drag + post-stall pressure drag
  const Cd0 = 0.0055 + 0.032 * t + 0.04 * m * m;
  const K = finiteWing ? 1 / (Math.PI * eOswald * AR) : 0.006;
  const cdStall = fSep * (1.75 * Math.sin(alpha) * Math.sin(alpha));
  const CD = Cd0 + K * CL * CL + cdStall;
  const LD = CD > 1e-9 ? CL / CD : 0;

  const atm = isaAtmosphere(altM);
  const q = 0.5 * atm.rho * V * V;
  const liftN = q * S * CL;
  const dragN = q * S * CD;
  const mach = V / atm.a;
  const stalled = Math.abs(alphaDeg) > alphaStallDeg;

  return {
    alphaDeg, alphaL0Deg, alphaStallDeg, liftSlope,
    CL, clLinear, CD, Cd0, K, LD, stalled,
    atm, q, liftN, dragN, mach,
  };
}

/** Sweep alpha from -8° to 24° for CL(alpha) and drag polar curves. */
export function airfoilPolarSweep(params) {
  const alphas = [], cls = [], clLin = [], cds = [], lds = [];
  let clMax = -Infinity, ldMax = -Infinity, alphaClMax = 0, alphaLdMax = 0;
  for (let a = -8; a <= 24; a += 0.5) {
    const r = evaluateAirfoil({ ...params, alphaDeg: a });
    alphas.push(a); cls.push(r.CL); clLin.push(r.clLinear); cds.push(r.CD); lds.push(r.LD);
    if (r.CL > clMax) { clMax = r.CL; alphaClMax = a; }
    if (r.LD > ldMax) { ldMax = r.LD; alphaLdMax = a; }
  }
  return { alphas, cls, clLin, cds, lds, clMax, ldMax, alphaClMax, alphaLdMax };
}

// =====================================================================
// 20. ATIŞ HAREKETİ & SÜRÜKLEME (Projectile with Quadratic Drag & Wind)
// =====================================================================

/** Analytical vacuum projectile trajectory (for comparison & exact tests). */
export function projectileVacuum({ v0 = 50, angleDeg = 45, h0 = 0, g = G0, n = 120 }) {
  const th = angleDeg * RAD;
  const vx = v0 * Math.cos(th), vy = v0 * Math.sin(th);
  const tFlight = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * h0))) / g;
  const range = vx * tFlight;
  const tApex = Math.max(0, vy / g);
  const maxHeight = h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0);
  const xs = [], ys = [], ts = [];
  for (let i = 0; i <= n; i++) {
    const t = (tFlight * i) / n;
    ts.push(t);
    xs.push(vx * t);
    ys.push(Math.max(0, h0 + vy * t - 0.5 * g * t * t));
  }
  return { tFlight, range, maxHeight, tApex, xs, ys, ts };
}

/**
 * RK4 2D projectile with quadratic aerodynamic drag and horizontal wind vWind [m/s].
 */
export function simulateProjectile({ v0 = 50, angleDeg = 45, h0 = 0, m = 0.5, Cd = 0.47, area = 0.005, rho = 1.225, vWind = 0, g = G0, dt = 0.015 }) {
  const th = angleDeg * RAD;
  let state = [0, h0, v0 * Math.cos(th), v0 * Math.sin(th)];
  const kDrag = (0.5 * rho * Cd * area) / Math.max(1e-6, m);

  const deriv = (_t, [_x, _y, vx, vy]) => {
    const rvx = vx - vWind;
    const rvy = vy;
    const spd = Math.hypot(rvx, rvy);
    return [vx, vy, -kDrag * spd * rvx, -g - kDrag * spd * rvy];
  };

  const ts = [0], xs = [0], ys = [h0], vs = [v0];
  let t = 0, maxHeight = h0;
  const maxSteps = 6000;
  for (let step = 0; step < maxSteps; step++) {
    const next = rk4Step(deriv, t, state, dt);
    if (next[1] <= 0 && step > 0) {
      // Linear interpolation for accurate ground landing
      const frac = state[1] / Math.max(1e-12, state[1] - next[1]);
      const tHit = t + frac * dt;
      const xHit = state[0] + frac * (next[0] - state[0]);
      const vxHit = state[2] + frac * (next[2] - state[2]);
      const vyHit = state[3] + frac * (next[3] - state[3]);
      ts.push(tHit); xs.push(xHit); ys.push(0); vs.push(Math.hypot(vxHit, vyHit));
      return {
        tFlight: tHit, range: xHit, maxHeight,
        vImpact: Math.hypot(vxHit, vyHit),
        ts, xs, ys, vs,
      };
    }
    state = next;
    t += dt;
    if (state[1] > maxHeight) maxHeight = state[1];
    ts.push(t); xs.push(state[0]); ys.push(state[1]); vs.push(Math.hypot(state[2], state[3]));
  }
  return { tFlight: t, range: state[0], maxHeight, vImpact: Math.hypot(state[2], state[3]), ts, xs, ys, vs };
}

/** Find optimal launch angle maximizing horizontal range via golden-section search. */
export function findOptimalProjectileAngle(params) {
  let a = 5, b = 85;
  const gr = (Math.sqrt(5) - 1) / 2;
  const evalR = ang => simulateProjectile({ ...params, angleDeg: ang, dt: 0.025 }).range;
  let c = b - gr * (b - a);
  let d = a + gr * (b - a);
  let fc = evalR(c), fd = evalR(d);
  for (let i = 0; i < 20; i++) {
    if (fc < fd) {
      a = c; c = d; fc = fd;
      d = a + gr * (b - a); fd = evalR(d);
    } else {
      b = d; d = c; fd = fc;
      c = b - gr * (b - a); fc = evalR(c);
    }
  }
  const optAngle = 0.5 * (a + b);
  const optSim = simulateProjectile({ ...params, angleDeg: optAngle });
  return { optAngle, maxRange: optSim.range, tFlight: optSim.tFlight };
}

// =====================================================================
// 21. UÇUŞ PERFORMANSI (Power Required, Min Drag, Breguet Range & Endurance)
// =====================================================================

/**
 * Steady level flight performance for propeller or jet aircraft at altitude altM.
 * Inputs:
 *   aircraft: 'prop' | 'jet'
 *   mass [kg], S [m^2], AR, eOswald, Cd0, ClMax, altM [m]
 *   fuelFrac: W_fuel / W_initial (0..0.6)
 *   prop: pShaftSL [W], etaProp, cpGkwH [g/(kW·h)] (specific fuel consumption)
 *   jet: thrustSL [N], tsfc [kg/(N·h)]
 */
export function solveFlightPerformance({
  aircraft = 'prop', mass = 1200, S = 16.2, AR = 7.4, eOswald = 0.8,
  Cd0 = 0.028, ClMax = 1.5, altM = 2000, Vcruise = 55,
  fuelFrac = 0.2,
  pShaftSL = 135e3, etaProp = 0.82, cpGkwH = 260,
  thrustSL = 45000, tsfc = 0.065,
}) {
  const atm = isaAtmosphere(altM);
  const rho = atm.rho;
  const rho0 = 1.225;
  const sigma = rho / rho0;
  const W = mass * G0;
  const K = 1 / (Math.PI * eOswald * AR);

  const vStall = Math.sqrt((2 * W) / (rho * S * ClMax));
  const vMinDrag = Math.sqrt(((2 * W) / (rho * S)) * Math.sqrt(K / Cd0));
  const vMinPower = vMinDrag * Math.pow(3, -0.25); // 0.7598 * V_md
  const vCarson = vMinDrag * Math.pow(3, 0.25);    // 1.3161 * V_md (optimal jet range speed)
  const ldMax = 1 / (2 * Math.sqrt(Cd0 * K));
  const minDrag = W / ldMax;
  const minPower = (4 / 3) * (W / ldMax) * vMinPower * Math.sqrt(3) * 0.5; // exact check below

  const dragAt = V => {
    const q = 0.5 * rho * V * V;
    const CL = W / (q * S);
    const Dp = q * S * Cd0;
    const Di = q * S * K * CL * CL;
    const D = Dp + Di;
    const CD = Cd0 + K * CL * CL;
    return { CL, CD, Dp, Di, D, PR: D * V, LD: CL / CD };
  };

  const pAvailAt = V => {
    if (aircraft === 'prop') {
      // Naturally aspirated piston engine drops approximately with sigma^1.0 (Gagg-Farrar approx)
      return etaProp * pShaftSL * sigma;
    }
    // Jet thrust scales ~ sigma^0.75..1.0; use standard sigma^0.85
    const Ta = thrustSL * Math.pow(sigma, 0.85);
    return Ta * V;
  };

  const atVmd = dragAt(vMinDrag);
  const atVmp = dragAt(vMinPower);
  const atCruise = dragAt(Math.max(vStall * 0.9, Vcruise));
  const paCruise = pAvailAt(Math.max(vStall * 0.9, Vcruise));
  const maxRC = Math.max(0, (pAvailAt(vMinPower) - atVmp.PR) / W);

  // Sweep speed from 0.9*vStall to vMaxSearch
  const vLo = Math.max(10, vStall * 0.85);
  const vHi = Math.max(vMinDrag * 2.6, Vcruise * 1.4, 120);
  const vs = [], pr = [], pa = [], dp = [], di = [], dtot = [];
  let vMax = vStall;
  for (let i = 0; i <= 140; i++) {
    const V = vLo + ((vHi - vLo) * i) / 140;
    const d = dragAt(V);
    const pav = pAvailAt(V);
    vs.push(V);
    pr.push(d.PR);
    pa.push(pav);
    dp.push(d.Dp);
    di.push(d.Di);
    dtot.push(d.D);
    if (pav >= d.PR && V >= vStall) vMax = V;
  }

  // Refine vMax by bisection if within upper bound
  if (pAvailAt(vMinPower) > atVmp.PR) {
    let lo = vMinPower, hi = vHi * 1.8;
    while (pAvailAt(hi) > dragAt(hi).PR && hi < 900) hi *= 1.3;
    for (let it = 0; it < 36; it++) {
      const mid = 0.5 * (lo + hi);
      if (pAvailAt(mid) > dragAt(mid).PR) lo = mid; else hi = mid;
    }
    vMax = 0.5 * (lo + hi);
  }

  // Breguet Range [m] & Endurance [s]
  const ff = clamp(fuelFrac, 0.02, 0.65);
  const Wi = W;
  const Wf = W * (1 - ff);
  const lnW = Math.log(Wi / Wf);

  let rangeCruise, enduranceCruise, rangeMax, enduranceMax;
  if (aircraft === 'prop') {
    // cp in kg/(W·s): g/(kW·h) * 1e-3 / (1000 * 3600) = cpGkwH * 1e-6 / 3600
    const cpSI = (cpGkwH * 1e-6) / 3600;
    const kProp = etaProp / (G0 * cpSI);
    rangeCruise = kProp * atCruise.LD * lnW;
    rangeMax = kProp * ldMax * lnW;
    // Exact constant-CL Breguet endurance: (eta/(g*cp)) * (CL^(3/2)/CD) * sqrt(2*rho*S) * (Wf^-0.5 - Wi^-0.5)
    const cl32CdCruise = Math.pow(atCruise.CL, 1.5) / atCruise.CD;
    const cl32CdOpt = Math.pow(atVmp.CL, 1.5) / atVmp.CD;
    const wTerm = Math.sqrt(2 * rho * S) * (1 / Math.sqrt(Wf) - 1 / Math.sqrt(Wi));
    enduranceCruise = kProp * cl32CdCruise * wTerm;
    enduranceMax = kProp * cl32CdOpt * wTerm;
  } else {
    // Jet TSFC in kg/(N·s): tsfc [kg/(N·h)] / 3600
    const ctSI = tsfc / 3600;
    const kJet = 1 / (G0 * ctSI);
    // Constant-CL, constant-altitude Breguet jet range: (2/(g*ct)) * sqrt(2/(rho*S)) * (CL^0.5/CD) * (Wi^0.5 - Wf^0.5)
    const atCarson = dragAt(vCarson);
    const wTerm = 2 * Math.sqrt(2 / (rho * S)) * (Math.sqrt(Wi) - Math.sqrt(Wf));
    rangeCruise = kJet * (Math.sqrt(atCruise.CL) / atCruise.CD) * wTerm;
    rangeMax = kJet * (Math.sqrt(atCarson.CL) / atCarson.CD) * wTerm;
    enduranceCruise = kJet * atCruise.LD * lnW;
    enduranceMax = kJet * ldMax * lnW;
  }

  return {
    atm, W, K, vStall, vMinDrag, vMinPower, vCarson, vMax,
    ldMax, minDrag, minPower: atVmp.PR, maxRC,
    atCruise, paCruise,
    rangeCruiseKm: rangeCruise / 1000,
    enduranceCruiseHr: enduranceCruise / 3600,
    rangeMaxKm: rangeMax / 1000,
    enduranceMaxHr: enduranceMax / 3600,
    vs, pr, pa, dp, di, dtot,
  };
}

// =====================================================================
// SHARED NUMERICAL FIELD & COLOR UTILITIES (Pure)
// =====================================================================

/**
 * Extract contour line segments for scalar field grid[row][col] at threshold level via marching squares.
 * Returns array of [x1, y1, x2, y2] in normalized grid coordinates [0, cols-1] x [0, rows-1].
 */
export function marchingSquares(grid, level) {
  const rows = grid.length;
  const cols = grid[0].length;
  const segs = [];
  const interp = (a, b) => {
    const d = b - a;
    return Math.abs(d) < 1e-12 ? 0.5 : clamp((level - a) / d, 0, 1);
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const v0 = grid[r][c];
      const v1 = grid[r][c + 1];
      const v2 = grid[r + 1][c + 1];
      const v3 = grid[r + 1][c];
      if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) continue;
      const mask = (v0 >= level ? 8 : 0) | (v1 >= level ? 4 : 0) | (v2 >= level ? 2 : 0) | (v3 >= level ? 1 : 0);
      if (mask === 0 || mask === 15) continue;
      // Edge midpoints: top(0), right(1), bottom(2), left(3)
      const pt = edge => {
        if (edge === 0) return [c + interp(v0, v1), r];
        if (edge === 1) return [c + 1, r + interp(v1, v2)];
        if (edge === 2) return [c + interp(v3, v2), r + 1];
        return [c, r + interp(v0, v3)];
      };
      const edges = [];
      if ((v0 >= level) !== (v1 >= level)) edges.push(0);
      if ((v1 >= level) !== (v2 >= level)) edges.push(1);
      if ((v2 >= level) !== (v3 >= level)) edges.push(2);
      if ((v3 >= level) !== (v0 >= level)) edges.push(3);
      if (edges.length === 2) {
        const a = pt(edges[0]), b = pt(edges[1]);
        segs.push([a[0], a[1], b[0], b[1]]);
      } else if (edges.length === 4) {
        const avg = 0.25 * (v0 + v1 + v2 + v3);
        const p0 = pt(0), p1 = pt(1), p2 = pt(2), p3 = pt(3);
        if ((avg >= level) === (v0 >= level)) {
          segs.push([p0[0], p0[1], p1[0], p1[1]], [p3[0], p3[1], p2[0], p2[1]]);
        } else {
          segs.push([p0[0], p0[1], p3[0], p3[1]], [p1[0], p1[1], p2[0], p2[1]]);
        }
      }
    }
  }
  return segs;
}

/** Approximate blackbody chromaticity RGB hex for temperature T [K] (700 K .. 20000 K). */
export function blackbodyColorHex(T) {
  if (T < 800) return '#2a0808';
  const t = clamp(T, 800, 20000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = clamp(99.4708025861 * Math.log(Math.max(1, t)) - 161.1195681661, 0, 255);
    b = t <= 19 ? 0 : clamp(138.5177312231 * Math.log(t - 10) - 305.0447927307, 0, 255);
  } else {
    r = clamp(329.698727446 * Math.pow(t - 60, -0.1332047592), 0, 255);
    g = clamp(288.1221695283 * Math.pow(t - 60, -0.0755148492), 0, 255);
    b = 255;
  }
  // Dim glow below 1500 K
  const dim = T < 1500 ? clamp((T - 700) / 800, 0.25, 1) : 1;
  const h = v => Math.round(v * dim).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Perceptual thermal colormap (deep blue -> violet -> orange -> gold -> white) for u in [0, 1]. */
export function thermalColorRGB(u) {
  const x = clamp(u, 0, 1);
  const stops = [
    [0.00,  16,  24,  68],
    [0.25,  48,  86, 178],
    [0.50, 168,  60, 136],
    [0.75, 240, 118,  48],
    [0.92, 255, 214,  88],
    [1.00, 255, 252, 232],
  ];
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < x) i++;
  const a = stops[i], b = stops[i + 1];
  const f = (x - a[0]) / Math.max(1e-9, b[0] - a[0]);
  return [
    Math.round(a[1] + f * (b[1] - a[1])),
    Math.round(a[2] + f * (b[2] - a[2])),
    Math.round(a[3] + f * (b[3] - a[3])),
  ];
}
