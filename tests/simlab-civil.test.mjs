import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  G0, R_GAS, N_AVO,
  erf, erfc, solveCubicReal, jacobiEigenSym,
  beamSectionProperties, solveBeam,
  solveTruss2D,
  solveFrame2D,
  solveMohrStress, solveStrainRosette,
  BUCKLING_BCS, solveColumnBuckling, sampleBucklingMode,
  syntheticGroundMotion, newmarkSDOF, computeResponseSpectrum, solveShearBuildingModes,
  terzaghiConsolidation, mohrCoulombSoil, terzaghiBearingCapacity, rankineEarthPressure,
  solveOpenChannel, solveRationalAndUH,
  solveHorizontalCurve, solveTrafficGreenshields,
  evaluateTensileCurve,
  analyzeCrystal, millerSpacing, millerPlanePolygon, computeXRD,
  evalIsomorphous, evalEutecticPbSn, evalFeFe3C,
  arrheniusD, fickErfcProfile, fickCaseDepth, createRandomWalkState, stepRandomWalk,
  solveSNBasquin, solveMeanStressCriteria, solveParisCrackGrowth,
  tttStartFinishTime, simulateCoolingPath,
  solveComposite,
  solveSemiconductor,
  solveIsothermalReactors, solveNonIsothermalCSTR,
  solveSeriesParallelKinetics, solveArrhenius, solveMichaelisMenten,
  solveChemicalEquilibrium, pHAtVolume, solveTitrationCurve,
  solveMcCabeThiele, solveRaoultDiagrams,
  solveFilmDiffusion, solveGasAbsorption, solveLLETernary,
  solveProcessFlowsheet,
  solveSettlingVelocity, solveErgunAndFluidization,
  solveEOS, eosIsotherm,
} from '../js/simlab-civil-core.js';

const approx = (a, b, tol = 1e-4, msg = '') => {
  assert.ok(Number.isFinite(a) && Number.isFinite(b), `Sayısal değil: ${a} vs ${b} ${msg}`);
  assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (fark ${Math.abs(a - b)} > ${tol}) ${msg}`);
};

const relApprox = (a, b, relTol = 1e-3, msg = '') => {
  assert.ok(Number.isFinite(a) && Number.isFinite(b), `Sayısal değil: ${a} vs ${b} ${msg}`);
  const denom = Math.max(1e-12, Math.abs(b));
  assert.ok(Math.abs(a - b) / denom <= relTol, `${a} ≈ ${b} (bağıl hata ${Math.abs(a - b) / denom} > ${relTol}) ${msg}`);
};

// =====================================================================
// SHARED MATH HELPERS
// =====================================================================

describe('0. Matematik Çekirdeği (erf/erfc, kübik, Jacobi)', () => {
  test('erf ve erfc bilinen değerler ve simetri', () => {
    approx(erf(0), 0, 1e-7);
    approx(erfc(0), 1, 1e-7);
    approx(erf(1), 0.84270079, 2e-6);
    approx(erfc(1), 0.15729921, 2e-6);
    approx(erf(-0.5), -erf(0.5), 1e-12);
    approx(erf(2) + erfc(2), 1, 1e-6);
    assert.ok(erfc(5) > 0 && erfc(5) < 1e-11);
  });

  test('Kübik çözücü (3 reel kök & 1 reel kök) ve simetrik Jacobi özdeğerleri', () => {
    const r3 = solveCubicReal(1, -6, 11, -6); // (x-1)(x-2)(x-3)
    assert.equal(r3.length, 3);
    approx(r3[0], 1, 1e-10); approx(r3[1], 2, 1e-10); approx(r3[2], 3, 1e-10);

    const r1 = solveCubicReal(1, 0, 1, -2); // x=1 tek reel kök
    assert.equal(r1.length, 1);
    approx(r1[0], 1, 1e-10);

    const eig = jacobiEigenSym([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]);
    approx(eig.values[0], 2 - Math.SQRT2, 1e-10);
    approx(eig.values[1], 2, 1e-10);
    approx(eig.values[2], 2 + Math.SQRT2, 1e-10);
  });
});

// =====================================================================
// FIELD: İNŞAAT & YAPI (1–9)
// =====================================================================

describe('1. Kiriş Analizi', () => {
  test('Basit kiriş orta tekil yük: R = P/2, M_max = PL/4, delta = PL^3/(48EI)', () => {
    const L = 6, P = 24, E_GPa = 200;
    const sec = { type: 'rect', b: 200, h: 400 };
    const r = solveBeam({ type: 'simply', L, E_GPa, section: sec, loads: [{ kind: 'point', x: 3, P }] });
    assert.equal(r.ok, true);
    approx(r.reactions[0].Ry, P / 2, 1e-6);
    approx(r.reactions[1].Ry, P / 2, 1e-6);
    approx(r.maxAbsM, (P * L) / 4, 1e-5);
    const deltaExactMm = ((P * L ** 3) / (48 * r.EI)) * 1000;
    relApprox(r.maxAbsYMm, deltaExactMm, 1e-4, 'Orta sehim');
    const prop = beamSectionProperties(sec);
    relApprox(r.maxSigmaMPa, ((P * L / 4) * 1e6) / prop.S, 1e-4);
    relApprox(r.maxTauMPa, (1.5 * (P / 2) * 1e3) / prop.A, 1e-4);
  });

  test('Ankastre (konsol) kiriş uç tekil yük + yayılı yük kapalı çözümleri', () => {
    const L = 4, P = 10;
    const r = solveBeam({ type: 'cantilever', L, E_GPa: 200, section: { type: 'ibeam', bf: 150, h: 300, tf: 12, tw: 8 }, loads: [{ kind: 'point', x: L, P }] });
    assert.equal(r.ok, true);
    approx(r.reactions[0].Ry, P, 1e-6);
    approx(r.reactions[0].Mz, P * L, 1e-5);
    approx(r.evalVM(0, 1).M, -P * L, 1e-5);
    approx(r.evalVM(L, -1).M, 0, 1e-5);
    relApprox(r.maxAbsYMm, ((P * L ** 3) / (3 * r.EI)) * 1000, 1e-4);
  });

  test('Çift ankastre (hiperstatik) kiriş düzgün yayılı yük: M_mesnet = -wL^2/12, M_orta = wL^2/24, delta = wL^4/(384EI)', () => {
    const L = 8, w = 15;
    const r = solveBeam({ type: 'fixed-fixed', L, E_GPa: 30, section: { type: 'circle', d: 400 }, loads: [{ kind: 'dist', x1: 0, x2: L, w1: w, w2: w }] });
    assert.equal(r.ok, true);
    approx(r.reactions[0].Ry, (w * L) / 2, 1e-5);
    approx(r.reactions[1].Ry, (w * L) / 2, 1e-5);
    approx(r.reactions[0].Mz, (w * L * L) / 12, 1e-4);
    approx(r.evalVM(0, 1).M, -(w * L * L) / 12, 1e-4);
    approx(r.evalVM(L / 2, 0).M, (w * L * L) / 24, 1e-4);
    relApprox(r.maxAbsYMm, ((w * L ** 4) / (384 * r.EI)) * 1000, 1e-4);
  });

  test('Üçgen yayılı yük (w1=0 → w2=w) basit kirişte R_A = wL/6, R_B = wL/3, M_max = wL^2/(9*sqrt(3))', () => {
    const L = 6, w = 18;
    const r = solveBeam({ type: 'simply', L, E_GPa: 200, loads: [{ kind: 'dist', x1: 0, x2: L, w1: 0, w2: w }] });
    approx(r.reactions[0].Ry, (w * L) / 6, 1e-4);
    approx(r.reactions[1].Ry, (w * L) / 3, 1e-4);
    relApprox(r.maxAbsM, (w * L * L) / (9 * Math.sqrt(3)), 2e-3);
  });

  test('Çıkmalı (overhanging) kiriş ve tekil moment sıçraması', () => {
    const r = solveBeam({
      type: 'overhanging', L: 8, supports: [0, 6],
      loads: [{ kind: 'point', x: 8, P: 12 }, { kind: 'moment', x: 3, M: 18 }],
    });
    assert.equal(r.ok, true);
    // Sum M_A = 0 => R_B * 6 - 12 * 8 - 18 = 0 => R_B = 114/6 = 19 kN, R_A = 12 - 19 = -7 kN
    approx(r.reactions[1].Ry, 19, 1e-5);
    approx(r.reactions[0].Ry, -7, 1e-5);
    const mBefore = r.evalVM(3, -1).M;
    const mAfter = r.evalVM(3, 1).M;
    approx(mAfter - mBefore, 18, 1e-5, 'Moment sıçraması');
  });
});

describe('2. Kafes Sistem (2D Truss)', () => {
  test('Eşkenar üçgen kafes: statik izostatik, kesin çubuk kuvvetleri ve global denge', () => {
    const H = Math.sqrt(3) * 2; // span 4 m, 60 deg
    const res = solveTruss2D({
      nodes: [
        { x: 0, y: 0, support: 'pin', fx: 0, fy: 0 },
        { x: 4, y: 0, support: 'roller-x', fx: 0, fy: 0 },
        { x: 2, y: H, support: 'free', fx: 0, fy: -100 },
      ],
      members: [
        { i: 0, j: 1, E_GPa: 200, A_cm2: 10 },
        { i: 0, j: 2, E_GPa: 200, A_cm2: 10 },
        { i: 1, j: 2, E_GPa: 200, A_cm2: 10 },
      ],
    });
    assert.equal(res.ok, true);
    assert.equal(res.determinacy, 'izostatik');
    approx(res.nodes[0].ry, 50, 1e-6);
    approx(res.nodes[1].ry, 50, 1e-6);
    // Diagonal force: N = -50 / sin(60°) = -100 / sqrt(3) ≈ -57.735 kN (compression)
    // Bottom chord: N = +50 / tan(60°) = +50 / sqrt(3) ≈ +28.8675 kN (tension)
    approx(res.members[0].force, 50 / Math.sqrt(3), 1e-5);
    approx(res.members[1].force, -100 / Math.sqrt(3), 1e-5);
    approx(res.members[2].force, -100 / Math.sqrt(3), 1e-5);
    approx(res.equilibriumError, 0, 1e-8);
  });

  test('Mekanizma (yetersiz çubuk) algılanır', () => {
    const res = solveTruss2D({
      nodes: [
        { x: 0, y: 0, support: 'pin' },
        { x: 4, y: 0, support: 'roller-x' },
        { x: 4, y: 3, support: 'free', fx: 10 },
        { x: 0, y: 3, support: 'free' },
      ],
      members: [{ i: 0, j: 3 }, { i: 3, j: 2 }, { i: 2, j: 1 }, { i: 0, j: 1 }], // 4-bar rectangle without diagonal
    });
    assert.equal(res.determinacy, 'mekanizma');
    assert.equal(res.ok, false);
  });
});

describe('3. Çerçeve Analizi (2D Frame)', () => {
  test('Simetrik ankastre portal çerçeve yatay yük altında mesnet kesme ve moment dengesi', () => {
    const H = 4, L = 6, P = 40;
    const res = solveFrame2D({
      nodes: [
        { x: 0, y: 0, support: 'fixed' },
        { x: 0, y: H, support: 'free', fx: P, fy: 0, mz: 0 },
        { x: L, y: H, support: 'free', fx: 0, fy: 0, mz: 0 },
        { x: L, y: 0, support: 'fixed' },
      ],
      members: [
        { i: 0, j: 1, E_GPa: 200, A_cm2: 50, I_cm4: 10000, w: 0 },
        { i: 1, j: 2, E_GPa: 200, A_cm2: 50, I_cm4: 10000, w: 20 },
        { i: 3, j: 2, E_GPa: 200, A_cm2: 50, I_cm4: 10000, w: 0 },
      ],
    });
    assert.equal(res.ok, true);
    // Global horizontal equilibrium: Rx0 + Rx3 + P = 0
    approx(res.nodes[0].rx + res.nodes[3].rx, -P, 1e-4);
    // Global vertical equilibrium: Ry0 + Ry3 = w*L = 120 kN
    approx(res.nodes[0].ry + res.nodes[3].ry, 20 * L, 1e-4);
    // Sway to the right
    assert.ok(res.nodes[1].uxMm > 0 && res.nodes[2].uxMm > 0);
  });
});

describe('4. Mohr Dairesi & Gerinim Rozeti', () => {
  test('Düzlem gerilme asal gerilmeleri, döndürme değişmezi ve von Mises / Tresca', () => {
    const m = solveMohrStress({ sx: 100, sy: -20, txy: 80, thetaDeg: 25, syYield: 250 });
    approx(m.center, 40, 1e-10);
    approx(m.radius, 100, 1e-10); // sqrt(60^2 + 80^2) = 100
    approx(m.s1, 140, 1e-10);
    approx(m.s2, -60, 1e-10);
    approx(m.sxp + m.syp, m.sx + m.sy, 1e-10, 'İz değişmezi');
    // At principal angle thetaP, shear must vanish
    const mp = solveMohrStress({ sx: 100, sy: -20, txy: 80, thetaDeg: m.thetaP });
    approx(mp.txyp, 0, 1e-9);
    approx(mp.sxp, 140, 1e-9);
    // von Mises = sqrt(140^2 - 140*(-60) + (-60)^2) = sqrt(19600 + 8400 + 3600) = sqrt(31600)
    approx(m.vonMises, Math.sqrt(31600), 1e-8);
    approx(m.tresca, 200, 1e-10);
  });

  test('Dikdörtgen (45°) ve Delta (60°) gerinim rozetleri gerçek gerinim durumunu geri verir', () => {
    const ex = 500, ey = -100, gxy = 300;
    const epsAt = deg => 0.5 * (ex + ey) + 0.5 * (ex - ey) * Math.cos(2 * deg * Math.PI / 180) + 0.5 * gxy * Math.sin(2 * deg * Math.PI / 180);

    const rect = solveStrainRosette({ type: 'rect', ea: epsAt(0), eb: epsAt(45), ec: epsAt(90), E_GPa: 200, nu: 0.3 });
    approx(rect.ex, ex, 1e-9); approx(rect.ey, ey, 1e-9); approx(rect.gxy, gxy, 1e-9);

    const delta = solveStrainRosette({ type: 'delta', ea: epsAt(0), eb: epsAt(60), ec: epsAt(120), E_GPa: 200, nu: 0.3 });
    approx(delta.ex, ex, 1e-9); approx(delta.ey, ey, 1e-9); approx(delta.gxy, gxy, 1e-9);
    approx(delta.stress.s1, rect.stress.s1, 1e-8);
  });
});

describe('5. Kolon Burkulması (Euler & Johnson)', () => {
  test('Euler ve Johnson eğrileri geçiş narinliği λ_c noktasında σ_y/2 değerinde teğet birleşir', () => {
    const E = 200, Sy = 250;
    const b = 100, h = 100; // r = 100 / sqrt(12)
    const rMm = 100 / Math.sqrt(12);
    const lamC = Math.sqrt((2 * Math.PI * Math.PI * E * 1000) / Sy);
    const L_m = (lamC * rMm) / 1000;
    const res = solveColumnBuckling({ bc: 'pin-pin', L_m, E_GPa: E, Sy_MPa: Sy, section: { type: 'rect', b, h }, P_kN: 500 });
    approx(res.slenderness, lamC, 1e-6);
    approx(res.sigmaEuler, Sy / 2, 1e-5);
    approx(res.sigmaJohnson, Sy / 2, 1e-5);

    // Fixed-fixed has 4x Euler critical load of pin-pin
    const pp = solveColumnBuckling({ bc: 'pin-pin', L_m: 6, E_GPa: E, Sy_MPa: Sy, section: { type: 'rect', b: 80, h: 80 } });
    const ff = solveColumnBuckling({ bc: 'fixed-fixed', L_m: 6, E_GPa: E, Sy_MPa: Sy, section: { type: 'rect', b: 80, h: 80 } });
    relApprox(ff.PcrEuler_kN, 4 * pp.PcrEuler_kN, 1e-8);
    approx(BUCKLING_BCS['fixed-pin'].K, 0.69915566, 1e-6);
  });

  test('Burkulma mod şekilleri sınır koşullarını sağlar', () => {
    for (const bc of ['pin-pin', 'fixed-pin', 'fixed-fixed']) {
      const m1 = sampleBucklingMode(bc, 1, 101);
      approx(m1.ys[0], 0, 1e-6, `${bc} xi=0`);
      approx(m1.ys[100], 0, 1e-5, `${bc} xi=1`);
    }
    const cf = sampleBucklingMode('fixed-free', 1, 101);
    approx(cf.ys[0], 0, 1e-6);
    approx(Math.abs(cf.ys[100]), 1, 1e-6);
  });
});

describe('6. Deprem Tepkisi (Newmark-beta & Kayma Binası Modları)', () => {
  test('Harmonik rezonansta Newmark-beta kararlı genlik 1/(2*zeta) * a_g / w_n^2', () => {
    const f = 2.0, Tn = 1 / f, zeta = 0.05;
    const gm = syntheticGroundMotion({ kind: 'harmonic', pgaG: 0.2, duration: 20, dt: 0.005, fHarmonic: f });
    const resp = newmarkSDOF({ Tn, zeta, ag: gm.ag, dt: gm.dt });
    const wn = 2 * Math.PI * f;
    const exactSteady = (0.2 * G0) / (wn * wn * 2 * zeta);
    relApprox(resp.maxU, exactSteady, 0.03, 'Rezonans tepe yer değiştirme');

    const spec = computeResponseSpectrum({ ag: gm.ag.slice(0, 600), dt: gm.dt, zeta, periods: [0.05, 0.5, 2.0] });
    assert.equal(spec.SaG.length, 3);
    assert.ok(spec.SaG[1] > spec.SaG[2]);
  });

  test('Çok katlı kayma binası özfrekansları ve etkin modal kütle toplamı = %100', () => {
    // 2-storey uniform m=100, k=10000: w1^2 = k/m*(3-sqrt(5))/2, w2^2 = k/m*(3+sqrt(5))/2
    const sb = solveShearBuildingModes({ masses: [100, 100], stiffnesses: [10000, 10000] });
    approx(sb.modes[0].omega ** 2, 100 * (3 - Math.sqrt(5)) / 2, 1e-8);
    approx(sb.modes[1].omega ** 2, 100 * (3 + Math.sqrt(5)) / 2, 1e-8);
    const sumRatio = sb.modes.reduce((s, m) => s + m.effMassRatio, 0);
    approx(sumRatio, 1.0, 1e-10, 'Etkin kütle toplamı');
  });
});

describe('7. Zemin Mekaniği', () => {
  test('Terzaghi 1D konsolidasyon: Tv=0.197 → U≈50%, Tv=0.848 → U≈90%', () => {
    const Hdr = 2, cv = 1;
    const c50 = terzaghiConsolidation({ cv, Hdr, dSigma: 100, t_days: (0.197 * Hdr * Hdr / cv) * 365.25 });
    approx(c50.U_pct, 50.0, 0.2);
    const c90 = terzaghiConsolidation({ cv, Hdr, dSigma: 100, t_days: (0.848 * Hdr * Hdr / cv) * 365.25 });
    approx(c90.U_pct, 90.0, 0.2);
  });

  test('Mohr-Coulomb, Terzaghi taşıma gücü (φ=0 → Nc=5.7; φ=30° → Nc=37.16, Nq=22.46) ve Rankine Ka*Kp=1', () => {
    const mc = mohrCoulombSoil({ c: 10, phiDeg: 30, sigma: 200, porePressure: 50, sigma3Eff: 100 });
    approx(mc.sigmaEff, 150, 1e-10);
    approx(mc.tauF, 10 + 150 * Math.tan(Math.PI / 6), 1e-8);
    approx(mc.sigma1EffFail, 300 + 20 * Math.sqrt(3), 1e-6);

    const b0 = terzaghiBearingCapacity({ B: 2, Df: 1, gamma: 18, c: 50, phiDeg: 0, shape: 'strip', FS: 3 });
    approx(b0.Nc, 5.7, 1e-10); approx(b0.Nq, 1.0, 1e-10); approx(b0.Ngamma, 0, 1e-10);
    approx(b0.qu, 50 * 5.7 + 18, 1e-6);

    const b30 = terzaghiBearingCapacity({ B: 2, Df: 1.5, gamma: 18, c: 20, phiDeg: 30, shape: 'strip', FS: 3 });
    approx(b30.Nq, 22.46, 0.05);
    approx(b30.Nc, 37.16, 0.08);

    const rk = rankineEarthPressure({ H: 6, gamma: 18, phiDeg: 30, c: 0, qs: 0, zw: 6 });
    approx(rk.Ka, 1 / 3, 1e-10);
    approx(rk.Kp, 3.0, 1e-10);
    approx(rk.Ka * rk.Kp, 1.0, 1e-12);
    approx(rk.Pa, 0.5 * (1 / 3) * 18 * 36, 0.05);
    approx(rk.ya, 2.0, 0.05);
  });
});

describe('8. Açık Kanal & Hidroloji', () => {
  test('Dikdörtgen kanalda kritik derinlik yc = (q^2/g)^(1/3), Emin = 1.5*yc ve Belanger sıçrama denklemi', () => {
    const b = 4, Q = 16, q = Q / b;
    const ch = solveOpenChannel({ b, z: 0, n: 0.015, S0: 0.001, Q, y1: 0.4 });
    const ycExact = Math.cbrt((q * q) / G0);
    approx(ch.yc, ycExact, 1e-6);
    approx(ch.Emin, 1.5 * ycExact, 1e-6);
    const y2Belanger = 0.5 * 0.4 * (Math.sqrt(1 + 8 * ch.Fr1 * ch.Fr1) - 1);
    approx(ch.y2, y2Belanger, 1e-5);
    const dEExact = ((ch.y2 - 0.4) ** 3) / (4 * 0.4 * ch.y2);
    approx(ch.dE, dEExact, 1e-5);
  });

  test('Rasyonel yöntem Q = CiA/3.6 ve Birim Hidrograf hacim korunumu', () => {
    const h = solveRationalAndUH({ C: 0.6, i_mmhr: 60, A_km2: 10, tp_hr: 2, dt_hr: 0.5, storms: [10, 25, 15], Qb: 3 });
    approx(h.Qp_rational, (0.6 * 60 * 10) / 3.6, 1e-10);
    relApprox(h.directVolM3, h.expectedVolM3, 1e-6, 'Akış hacmi yağış hacmine eşit');
  });
});

describe('9. Ulaştırma & Trafik', () => {
  test('Yatay kurp minimum yarıçap, duruş görüş mesafesi ve Greenshields kapasite q_max = vf*kj/4', () => {
    const c = solveHorizontalCurve({ V_kmh: 90, R: 350, ePct: 6, fs: 0.13, tr: 2.5, gradePct: 0, aDecel: 3.4 });
    const v = 90 / 3.6;
    approx(c.Rmin, (v * v) / (G0 * 0.19), 1e-6);
    approx(c.SSD, v * 2.5 + (v * v) / (2 * 3.4), 1e-6);

    const tr = solveTrafficGreenshields({ vf: 100, kj: 120, k: 60 });
    approx(tr.qMax, 3000, 1e-10);
    approx(tr.q, 3000, 1e-10);
    approx(tr.v, 50, 1e-10);
  });
});

// =====================================================================
// FIELD: MALZEME (10–17)
// =====================================================================

describe('10. Gerilme-Şekil Değiştirme', () => {
  test('Elastik rezilyans U_r = sy^2/(2E), tokluk alanı ve gevrek seramik davranışı', () => {
    const st = evaluateTensileCurve('steel');
    approx(st.resilience_MJm3, (250 * 250) / (2 * 200000), 1e-8);
    assert.ok(st.toughness_MJm3 > 80 && st.toughness_MJm3 < 130);
    assert.ok(Math.abs(st.sy02 - 250) < 10);

    const cer = evaluateTensileCurve('ceramic');
    approx(cer.toughness_MJm3, cer.resilience_MJm3, 1e-4, 'Gevrek malzeme tokluk ≈ rezilyans');
  });
});

describe('11. Kristal Yapılar & XRD', () => {
  test('SC, BCC, FCC, HCP atomik dolgu faktörleri, koordinasyon sayıları ve Cu/Fe yoğunlukları', () => {
    const sc = analyzeCrystal({ lattice: 'SC', a_A: 3.35, aw: 208.98 });
    approx(sc.APF, Math.PI / 6, 1e-6); assert.equal(sc.CN, 6);

    const bcc = analyzeCrystal({ lattice: 'BCC', a_A: 2.866, aw: 55.845 });
    approx(bcc.APF, (Math.sqrt(3) * Math.PI) / 8, 1e-6); assert.equal(bcc.CN, 8);
    approx(bcc.density_gcm3, 7.87, 0.03, 'α-Fe yoğunluğu');

    const fcc = analyzeCrystal({ lattice: 'FCC', a_A: 3.615, aw: 63.546 });
    approx(fcc.APF, (Math.sqrt(2) * Math.PI) / 6, 1e-6); assert.equal(fcc.CN, 12);
    approx(fcc.density_gcm3, 8.93, 0.04, 'Cu yoğunluğu');

    const hcp = analyzeCrystal({ lattice: 'HCP', a_A: 3.209, c_A: 3.209 * Math.sqrt(8 / 3), aw: 24.305 });
    approx(hcp.APF, (Math.sqrt(2) * Math.PI) / 6, 1e-6); assert.equal(hcp.CN, 12);
  });

  test('Miller düzlem poligonu ve Cu FCC XRD ilk piki (111) ≈ 43.3°', () => {
    const poly = millerPlanePolygon(1, 1, 1);
    assert.equal(poly.length, 3);
    const d111 = millerSpacing({ lattice: 'FCC', a_A: 3.615, h: 1, k: 1, l: 1 });
    approx(d111, 3.615 / Math.sqrt(3), 1e-8);

    const peaks = computeXRD({ lattice: 'FCC', a_A: 3.615, lambda_A: 1.5406 });
    assert.equal(peaks[0].label, '(111)');
    approx(peaks[0].twoTheta, 43.32, 0.1);
    assert.equal(peaks[1].label, '(200)');
    approx(peaks[1].twoTheta, 50.45, 0.1);
  });
});

describe('12. Faz Diyagramları', () => {
  test('Cu-Ni kaldıraç kuralı kütle ve bileşim korunumu', () => {
    const iso = evalIsomorphous(50, 1300);
    assert.equal(iso.phases.length, 2);
    const [L, A] = iso.phases;
    approx(L.frac + A.frac, 1.0, 1e-10);
    approx(L.frac * L.comp + A.frac * A.comp, 50, 1e-6);
  });

  test('Pb-Sn ötektik ve Fe-Fe3C ötektoid/hipoötektoid faz oranları', () => {
    const pbsn = evalEutecticPbSn(40, 150);
    approx(pbsn.phases[0].frac + pbsn.phases[1].frac, 1.0, 1e-10);
    approx(pbsn.phases[0].frac * pbsn.phases[0].comp + pbsn.phases[1].frac * pbsn.phases[1].comp, 40, 1e-5);

    const fe = evalFeFe3C(0.4, 700);
    approx(fe.phases[0].frac + fe.phases[1].frac, 1.0, 1e-10);
    approx(fe.phases[0].frac * fe.phases[0].comp + fe.phases[1].frac * fe.phases[1].comp, 0.4, 1e-4);
    assert.ok(fe.pearliteFrac > 0.45 && fe.pearliteFrac < 0.56);
  });
});

describe('13. Difüzyon (Fick & Rastgele Yürüyüş)', () => {
  test('Arrhenius sıcaklık bağımlılığı, erfc profili ve yüzey sertleştirme derinliği', () => {
    const D900 = arrheniusD(2.3e-5, 148, 1173.15);
    const D1000 = arrheniusD(2.3e-5, 148, 1273.15);
    assert.ok(D1000 > D900 * 2.5);

    const prof = fickErfcProfile({ C0: 0.2, Cs: 1.2, D: D900, t_s: 36000, xMax_mm: 2.0 });
    approx(prof.C[0], 1.2, 1e-6);
    assert.ok(prof.C[prof.C.length - 1] < prof.C[0]);

    const xCase = fickCaseDepth({ C0: 0.2, Cs: 1.2, Ctarget: 0.7, D: D900, t_s: 36000 });
    // erfc(z) = 0.5 => z ≈ 0.476936
    approx(xCase, 2 * 0.476936 * Math.sqrt(D900 * 36000) * 1000, 1e-3);

    const rw = createRandomWalkState(120, 'point', 99);
    const st = stepRandomWalk(rw, 0.01, 50);
    assert.ok(st.msd > 0 && st.steps === 50);
  });
});

describe('14. Yorulma & Kırılma', () => {
  test('Basquin S-N, Goodman/Soderberg sıralaması (n_Soderberg <= n_Goodman <= n_Gerber) ve Paris entegrali', () => {
    const sn = solveSNBasquin({ Sut: 600, Se: 270, hasEnduranceLimit: true, sigmaA: 260 });
    assert.equal(sn.lifeN, Infinity);
    const snFin = solveSNBasquin({ Sut: 600, Se: 270, hasEnduranceLimit: true, sigmaA: 0.9 * 600 });
    relApprox(snFin.lifeN, 1e3, 1e-5);

    const ms = solveMeanStressCriteria({ sigmaA: 120, sigmaM: 150, Se: 270, Sut: 600, Sy: 450 });
    assert.ok(ms.nSoderberg < ms.nGoodman && ms.nGoodman < ms.nGerber);

    const paris = solveParisCrackGrowth({ a0_mm: 1, Y: 1.12, sigmaMax: 150, sigmaMin: 0, KIc: 60, C_paris: 1e-11, m_paris: 3 });
    assert.equal(paris.fracturedImmediately, false);
    const acExactMm = (1 / Math.PI) * Math.pow(60 / (1.12 * 150), 2) * 1000;
    approx(paris.ac_mm, acExactMm, 1e-5);
    assert.ok(paris.Nf_exact > 1e4);
  });
});

describe('15. Isıl İşlem (TTT Diyagramı)', () => {
  test('Hızlı su verme → %98+ Martensit; 660 °C izotermal tutma → Kaba Perlit; 350 °C → Beynit', () => {
    const nose = tttStartFinishTime(540);
    assert.ok(nose.ts < 1.5 && nose.tf > nose.ts);

    const quench = simulateCoolingPath([{ t: 0.05, T: 800 }, { t: 0.4, T: 25 }]);
    assert.ok(quench.martensite > 95 && quench.hrc > 60);

    const anneal = simulateCoolingPath([{ t: 0.1, T: 800 }, { t: 1, T: 660 }, { t: 5000, T: 660 }, { t: 6000, T: 25 }]);
    assert.ok(anneal.coarsePearlite > 95 && anneal.hrc < 25);

    const austemper = simulateCoolingPath([{ t: 0.05, T: 800 }, { t: 0.3, T: 350 }, { t: 2000, T: 350 }, { t: 2500, T: 25 }]);
    assert.ok(austemper.bainite > 90 && austemper.hrc > 40 && austemper.hrc < 52);
  });
});

describe('16. Kompozit Malzemeler', () => {
  test('Voigt ≥ Halpin-Tsai ≥ Reuss eşitsizliği ve açısal uç değerler E(0°)=E1, E(90°)=E2', () => {
    const c = solveComposite({ Ef: 230, Em: 3.5, Vf: 0.6, thetaDeg: 45 });
    approx(c.E1, 0.6 * 230 + 0.4 * 3.5, 1e-10);
    approx(c.E2, 1 / (0.6 / 230 + 0.4 / 3.5), 1e-10);
    assert.ok(c.E1 > c.E2_HT && c.E2_HT > c.E2);
    approx(c.evalAngle(0), c.E1, 1e-10);
    approx(c.evalAngle(90), c.E2, 1e-10);
  });
});

describe('17. Yarı İletken Malzeme', () => {
  test('Kütle etki yasası n*p = ni^2, yük nötrlüğü n - p = Nd - Na ve Si 300K değerleri', () => {
    const si = solveSemiconductor({ material: 'Si', T_K: 300, Nd: 1e16, Na: 0 });
    approx(si.Eg, 1.124, 0.01);
    assert.ok(si.ni > 5e9 && si.ni < 2e10);
    relApprox(si.n * si.p, si.ni * si.ni, 1e-8, 'Kütle etki yasası');
    relApprox(si.n - si.p, 1e16, 1e-8, 'Yük nötrlüğü');
    assert.ok(si.Ef > si.Ei && si.Ef < si.Eg, 'n-tipi Fermi seviyesi Ei üzerinde');

    const pSi = solveSemiconductor({ material: 'Si', T_K: 300, Nd: 0, Na: 1e16 });
    assert.ok(pSi.Ef < pSi.Ei && pSi.Ef > 0, 'p-tipi Fermi seviyesi Ei altında');
  });
});

// =====================================================================
// FIELD: KİMYA MÜHENDİSLİĞİ (18–25)
// =====================================================================

describe('18. Reaktör Tasarımı', () => {
  test('1. ve 2. derece PFR > N-CSTR > 1-CSTR sıralaması ve tersinir denge sınırı', () => {
    const r1 = solveIsothermalReactors({ order: '1st', k: 0.5, tau: 4, nCSTR: 4, Xtarget: 0.8 });
    approx(r1.X_PFR, 1 - Math.exp(-2), 1e-10);
    approx(r1.X_CSTR, 2 / 3, 1e-10);
    approx(r1.X_NCSTR, 1 - Math.pow(1 + 0.5, -4), 1e-10);
    assert.ok(r1.X_PFR > r1.X_NCSTR && r1.X_NCSTR > r1.X_CSTR);
    assert.ok(r1.V_CSTR > r1.V_PFR);

    const rev = solveIsothermalReactors({ order: 'rev1', k: 0.6, kRev: 0.2, tau: 100 });
    approx(rev.Xeq, 0.75, 1e-10);
    assert.ok(rev.X_PFR <= 0.75 && rev.X_PFR > 0.749);
  });

  test('İzotermal olmayan ekzotermik CSTR çoklu kararlı haller (3 kesişim: kararlı-kararsız-kararlı)', () => {
    const ni = solveNonIsothermalCSTR({ tau: 60, k0: 3.4e8, Ea_kJ: 75, negDH_kJ: 90, CA0: 2.0, v0: 0.5, Cp_kJ: 0.22, T0: 320, Tc: 315, UA_kW: 0.50 });
    assert.equal(ni.steadyStates.length, 3, `Beklenen 3 kararlı hal, bulunan: ${ni.steadyStates.length}`);
    assert.equal(ni.steadyStates[0].stable, true);
    assert.equal(ni.steadyStates[1].stable, false);
    assert.equal(ni.steadyStates[2].stable, true);
  });
});

describe('19. Reaksiyon Kinetiği', () => {
  test('Seri A→B→C kütle korunumu, t_max, k1=k2 limiti ve Michaelis-Menten v(Km)=Vmax/2', () => {
    const ser = solveSeriesParallelKinetics({ mode: 'series', k1: 0.8, k2: 0.2, CA0: 2.0, tMax: 15 });
    approx(ser.tMaxB, Math.log(0.2 / 0.8) / (0.2 - 0.8), 1e-10);
    for (let i = 0; i < ser.ts.length; i++) {
      approx(ser.CA[i] + ser.CB[i] + ser.CC[i], 2.0, 1e-9);
    }
    const deg = solveSeriesParallelKinetics({ mode: 'series', k1: 0.5, k2: 0.5, CA0: 1.0, tMax: 10 });
    approx(deg.CBmax, 1 / Math.E, 1e-10);

    const arr = solveArrhenius({ A: 1e10, Ea_kJ: 65, T1_K: 300, T2_K: 350 });
    assert.ok(arr.k2 > arr.k1 && arr.Q10 > 1.5);

    const mm = solveMichaelisMenten({ Vmax: 12, Km: 3, inhibition: 'competitive', I: 3, Ki: 3 });
    approx(mm.KmEff, 6, 1e-10);
    approx(mm.VmaxEff, 12, 1e-10);
    approx((mm.Vmax * mm.Km) / (mm.Km + mm.Km), mm.Vmax / 2, 1e-10);
  });
});

describe('20. Kimyasal Denge & Asit-Baz Titrasyonu', () => {
  test('Haber-Bosch dengesi: Q_p(xi_eq) = K_p ve basınç artışı NH3 verimini artırır', () => {
    const eq1 = solveChemicalEquilibrium({ reactionId: 'haber', T_K: 650, P_bar: 20 });
    const eq2 = solveChemicalEquilibrium({ reactionId: 'haber', T_K: 650, P_bar: 100 });
    const [pN2, pH2, pNH3] = eq1.pEq;
    const qpCheck = (pNH3 ** 2) / (pN2 * pH2 ** 3);
    relApprox(qpCheck, eq1.Kp, 1e-5, 'Dengede Qp = Kp');
    assert.ok(eq2.nEq[2] > eq1.nEq[2], 'Yüksek basınç NH3 yönüne kaydırır');
  });

  test('Kuvvetli ve zayıf asit titrasyonu: eşdeğerlik ve yarı-eşdeğerlik (pH = pKa)', () => {
    const pHS = pHAtVolume({ mode: 'strong-acid', Ca: 0.1, Va_mL: 50, Cb: 0.1, Vb_mL: 50 });
    approx(pHS, 7.0, 1e-9);

    const tc = solveTitrationCurve({ mode: 'weak-acid', Ca: 0.1, Va_mL: 50, Cb: 0.1, pKa: 4.76 });
    approx(tc.pHHalf, 4.76, 0.01, 'Yarı-eşdeğerlik tamponu pH ≈ pKa');
    assert.ok(tc.pHEq > 8.5 && tc.pHEq < 9.0, 'Zayıf asit + kuvvetli baz eşdeğerliği bazik');
  });
});

describe('21. Damıtma (McCabe-Thiele & Raoult)', () => {
  test('McCabe-Thiele: R <= Rmin reddedilir, N >= Nmin (Fenske), yüksek R raf sayısını azaltır', () => {
    const lowR = solveMcCabeThiele({ alpha: 2.5, zF: 0.5, xD: 0.92, xW: 0.08, q: 1.0, R: 0.5 });
    assert.equal(lowR.ok, false);
    assert.ok(lowR.Rmin > 0.8);

    const r1 = solveMcCabeThiele({ alpha: 2.5, zF: 0.5, xD: 0.92, xW: 0.08, q: 1.0, R: 2.0 });
    const r2 = solveMcCabeThiele({ alpha: 2.5, zF: 0.5, xD: 0.92, xW: 0.08, q: 1.0, R: 6.0 });
    assert.equal(r1.ok, true);
    assert.ok(r1.stagesExact > r1.Nmin && r2.stagesExact < r1.stagesExact);

    const raoult = solveRaoultDiagrams({ mixtureId: 'ben-tol', T_C: 95, P_kPa: 101.325 });
    approx(raoult.Tb1, 80.1, 0.4, 'Benzen kaynama noktası ~80.1 C');
    approx(raoult.Tb2, 110.6, 0.4, 'Toluen kaynama noktası ~110.6 C');
  });
});

describe('22. Kütle Transferi', () => {
  test('Stefan sürüklenme akısı > eşmolar akı, Kremser absorpsiyonu ve üçgen LLE kütle dengesi', () => {
    const fd = solveFilmDiffusion({ DAB_cm2s: 0.25, C_molm3: 40, delta_mm: 2, xA1: 0.6, xA2: 0.05 });
    assert.ok(fd.NA_stagnant > fd.NA_equimolar);
    // Dilute limit: driftFactor -> 1
    const fdDil = solveFilmDiffusion({ DAB_cm2s: 0.25, C_molm3: 40, delta_mm: 2, xA1: 0.005, xA2: 0.001 });
    approx(fdDil.driftFactor, 1.0, 0.005);

    const abs = solveGasAbsorption({ m: 1.2, Gs: 100, Ls: 180, Yin: 0.08, Yout: 0.008, Xin: 0 });
    assert.equal(abs.ok, true);
    approx(abs.Gs * (abs.Yin - abs.Yout), abs.Ls * (abs.Xout - abs.Xin), 1e-9);
    assert.ok(abs.N_kremser > 3 && abs.N_kremser < 15);

    const lle = solveLLETernary({ xBF: 0.30, SoverF: 1.0, F: 100 });
    assert.equal(lle.inTwoPhase, true);
    approx(lle.F_R + lle.F_E, 200, 1e-6);
    approx(lle.F_R * lle.R.xB + lle.F_E * lle.E.xB, 30, 1e-4, 'Çözünen kütle korunumu');
  });
});

describe('23. Kütle & Enerji Dengesi (Akış Şeması)', () => {
  test('Kararlı hal molar ve bileşen kütle dengesi tüm birimlerde kapalı', () => {
    const fs = solveProcessFlowsheet({ F0: 100, yI0: 0.05, Xsp: 0.35, sepEff: 0.95, fPurge: 0.10 });
    approx(fs.molarClosureErr, 0, 1e-10, 'Toplam mol korunumu (A->B 1:1)');
    approx(fs.streams.purge.I, fs.streams.fresh.I, 1e-10, 'İnert giriş = inert blöf');
    approx(fs.streams.reactorIn.total, fs.streams.fresh.total + fs.streams.recycle.total, 1e-10, 'Karıştırıcı dengesi');
    assert.ok(fs.Xoverall > fs.Xsp, 'Geri döngü toplam dönüşümü artırır');
  });
});

describe('24. Akışkan Yatak & Çökelme', () => {
  test('Küçük tanecikte Stokes limiti ve akışkan yatakta ΔP(u_mf) = ağırlık/alan', () => {
    const stokes = solveSettlingVelocity({ dp_mm: 0.02, rhoP: 2650, rhoF: 1000, mu_mPas: 1.0 });
    assert.ok(stokes.ReP < 0.05);
    relApprox(stokes.ut, stokes.uStokes, 0.02);

    const coarse = solveSettlingVelocity({ dp_mm: 2.0, rhoP: 2650, rhoF: 1000, mu_mPas: 1.0 });
    assert.ok(coarse.ut < coarse.uStokes, 'Ara/Newton rejiminde sürükleme Stokes\'tan büyük');

    const fb = solveErgunAndFluidization({ dp_mm: 0.8, rhoP: 2600, rhoF: 1.2, mu_mPas: 0.0185, eps: 0.42, L_m: 1.0, u0: 0.5 });
    const fbAtUmf = solveErgunAndFluidization({ dp_mm: 0.8, rhoP: 2600, rhoF: 1.2, mu_mPas: 0.0185, eps: 0.42, L_m: 1.0, u0: fb.umf });
    relApprox(fbAtUmf.dP_ergun_Pa, fbAtUmf.dP_mf_Pa, 1e-6, 'u_mf hızında Ergun = yatak ağırlığı');
    assert.ok(fb.ut > fb.umf);
  });
});

describe('25. Gaz Yasaları (EOS)', () => {
  test('Düşük basınçta Z → 1, kritik noktada Z_vdW = 0.375 ve Z_PR ≈ 0.3074', () => {
    const lowP = solveEOS({ gasId: 'CO2', T_K: 350, P_bar: 0.5 });
    approx(lowP.Z_vdW, 1.0, 0.01);
    approx(lowP.Z_PR, 1.0, 0.01);

    const crit = solveEOS({ gasId: 'CO2', T_K: 304.13, P_bar: 73.77 });
    approx(crit.Z_vdW, 0.375, 0.002, 'vdW kritik sıkıştırılabilirlik 3/8');
    approx(crit.Z_PR, 0.3074, 0.005, 'PR kritik sıkıştırılabilirlik ≈ 0.3074');

    const iso = eosIsotherm({ gasId: 'CO2', T_K: 304.13 });
    assert.equal(iso.Vs_Lmol.length, 120);
  });
});

// =====================================================================
// MODULE CONTRACT, MOUNT SMOKE & HYGIENE CHECKS
// =====================================================================

describe('26. simlab-civil.js Modül Sözleşmesi ve Hijyen Kontrolleri', () => {
  test('SIMS sözleşmesi: 25 simülasyon (9 insaat + 8 malzeme + 8 kimya), geçerli id/ikon/başlık, ham $...$ yok', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    const uiSrc = fs.readFileSync(path.join(dir, '../js/simlab-civil.js'), 'utf8');
    const coreSrc = fs.readFileSync(path.join(dir, '../js/simlab-civil-core.js'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(dir, '../css/simlab-civil.css'), 'utf8');

    // Pure core must not import DOM/UI helpers
    assert.ok(!/from\s+['"]\.\/(ui|fx|phys-ui|tools)\.js['"]/.test(coreSrc), 'Core DOM modülü içe aktarmamalı');
    assert.ok(!/\bdocument\b|\bwindow\b/.test(coreSrc), 'Core DOM nesnesi kullanmamalı');

    // CSS custom classes must be prefixed .slc- (only html[data-motion=...] allowed as ancestor)
    const badCls = [...cssSrc.matchAll(/(?:^|[,\s{])\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)]
      .map(m => m[1])
      .filter(c => !c.startsWith('slc-') && c !== 'katex-display');
    assert.deepEqual(badCls, [], `Öneksiz CSS sınıfı bulundu: ${badCls.join(', ')}`);

    // Check introHtml calls never contain raw $...$ math (outside template interpolations ${...})
    for (const m of uiSrc.matchAll(/introHtml\('([^']*)'/g)) {
      assert.ok(!/\$[^$\n]+\$/.test(m[1]), `introHtml içinde ham TeX $...$ bulundu: ${m[1].slice(0, 60)}`);
    }

    // Minimal DOM stub to import js/simlab-civil.js in Node
    const noop = () => {};
    const timers = [];
    const stubEl = () => ({
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      dataset: {},
      style: { setProperty: noop },
      setAttribute: noop,
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      append: noop,
      prepend: noop,
      remove: noop,
      closest: () => null,
    });
    const prev = {
      window: globalThis.window,
      document: globalThis.document,
      matchMedia: globalThis.matchMedia,
      addEventListener: globalThis.addEventListener,
      dispatchEvent: globalThis.dispatchEvent,
      getComputedStyle: globalThis.getComputedStyle,
      setTimeout: globalThis.setTimeout,
      devicePixelRatio: globalThis.devicePixelRatio,
    };
    try {
      globalThis.devicePixelRatio = 1;
      globalThis.setTimeout = (fn, ms, ...a) => { const h = prev.setTimeout(fn, ms, ...a); timers.push(h); return h; };
      globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
      globalThis.addEventListener = noop;
      globalThis.dispatchEvent = noop;
      globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#60a5fa' });
      globalThis.document = {
        hidden: true,
        hasFocus: () => false,
        documentElement: stubEl(),
        body: stubEl(),
        head: stubEl(),
        addEventListener: noop,
        removeEventListener: noop,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: stubEl,
      };
      globalThis.window = {
        addEventListener: noop,
        removeEventListener: noop,
        devicePixelRatio: 1,
      };

      const { SIMS } = await import('../js/simlab-civil.js');
      assert.ok(Array.isArray(SIMS), 'SIMS dizi olmalı');
      assert.equal(SIMS.length, 25, 'Toplam 25 simülasyon (9 insaat + 8 malzeme + 8 kimya)');
      assert.equal(SIMS.filter(s => s.field === 'insaat').length, 9);
      assert.equal(SIMS.filter(s => s.field === 'malzeme').length, 8);
      assert.equal(SIMS.filter(s => s.field === 'kimya').length, 8);

      const forbiddenIds = new Set([
        'dc', 'transient', 'phasor', 'filter', 'opamp', 'logic',
        'diode-rectifier', 'transistor-curves', 'power-electronics', 'three-phase-power',
        'transformer-motor', 'transmission-line', 'em-fields', 'antenna-pattern',
        'communications', 'digital-circuits', 'pid-control', 'root-locus',
        'bode-nyquist', 'state-space', 'signals-fourier', 'sampling-aliasing',
        'convolution', 'digital-filter', 'laplace-z',
        'four-bar-linkage', 'vibration-sdof', 'two-dof-modal', 'rigid-collision',
        'gear-cam', 'shaft-spring', 'robot-arm', 'pendulum-gyro',
        'thermo-cycles', 'ideal-gas-kinetic', 'heat-conduction', 'fin-heat-exchanger',
        'pipe-flow', 'potential-flow', 'hydrostatics-buoyancy', 'thermal-radiation',
        'orbital-mechanics', 'rocket-equation', 'airfoil-naca', 'projectile-drag',
        'flight-performance',
      ]);
      const validIcons = new Set('home book review tool settings plus pen marker eraser select line arrow rect ellipse text image undo redo trash download upload fit calc back check play pause clock sigma x dots search flame chart grid wave resistor matrix phasor edit side star install sparkle rotate atom'.split(' '));
      const seen = new Set();

      for (const s of SIMS) {
        assert.ok(/^[a-z0-9-]+$/.test(s.id), `Geçersiz kebab id: ${s.id}`);
        assert.ok(!seen.has(s.id), `Yinelenen id: ${s.id}`);
        assert.ok(!forbiddenIds.has(s.id), `Çakışan id: ${s.id}`);
        seen.add(s.id);
        assert.ok(s.title.length > 0 && s.title.length <= 22, `Başlık <= 22 karakter olmalı: "${s.title}" (${s.title.length})`);
        assert.ok(validIcons.has(s.icon), `Geçersiz ikon adı: ${s.icon}`);
        assert.equal(typeof s.mount, 'function', `${s.id} mount fonksiyonu içermeli`);
      }

      // Deep mount + render + cleanup smoke test across ALL 25 simulations!
      const mockCtx2d = () => {
        const grad = { addColorStop: noop };
        return new Proxy({
          save: noop, restore: noop, scale: noop, setTransform: noop, clearRect: noop,
          beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
          rect: noop, fillRect: noop, strokeRect: noop, fill: noop, stroke: noop, clip: noop,
          bezierCurveTo: noop, quadraticCurveTo: noop, setLineDash: noop,
          translate: noop, rotate: noop, fillText: noop, strokeText: noop,
          measureText: s => ({ width: String(s).length * 7 }),
          createLinearGradient: () => grad,
          createRadialGradient: () => grad,
        }, { set(t, k, v) { t[k] = v; return true; } });
      };

      const makeFakeNode = (tag = 'div', attrs = {}) => {
        const children = [];
        const listeners = new Map();
        const node = {
          tagName: tag.toUpperCase(),
          attrs: { ...attrs },
          dataset: {},
          className: attrs.class || '',
          hidden: false,
          checked: 'checked' in attrs,
          value: attrs.value ?? '',
          textContent: '',
          clientWidth: 640,
          clientHeight: 300,
          width: 640,
          height: 300,
          parentElement: null,
          children,
          style: { setProperty: noop },
          classList: {
            add: noop, remove: noop,
            toggle(c, f) { return !!f; },
            contains: () => false,
          },
          setAttribute(k, v) { node.attrs[k] = String(v); },
          getAttribute(k) { return node.attrs[k] ?? null; },
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 280 }),
          getContext: () => mockCtx2d(),
          addEventListener(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); },
          removeEventListener: noop,
          append(...els) { els.forEach(el => { if (el && typeof el === 'object') { el.parentElement = node; children.push(el); } }); },
          prepend(...els) { els.forEach(el => { if (el && typeof el === 'object') { el.parentElement = node; children.unshift(el); } }); },
          closest: () => null,
          matches(sel) {
            for (const part of sel.split(',').map(s => s.trim())) {
              const segs = part.split(/\s+/);
              const last = segs[segs.length - 1];
              if (last.startsWith('#')) { if (node.attrs.id === last.slice(1)) return true; continue; }
              const dataM = /^\[data-([a-z0-9-]+)(?:="([^"]*)")?\]$/.exec(last);
              if (dataM) {
                const k = dataM[1].replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
                if (k in node.dataset && (dataM[2] === undefined || node.dataset[k] === dataM[2])) return true;
                continue;
              }
              if (last.startsWith('.')) { if (node.className.split(/\s+/).includes(last.slice(1))) return true; continue; }
              if (last.toUpperCase() === node.tagName) return true;
            }
            return false;
          },
          querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
          querySelectorAll(sel) {
            const out = [];
            const walk = cur => {
              for (const ch of cur.children) {
                if (ch.matches(sel)) out.push(ch);
                walk(ch);
              }
            };
            walk(node);
            return out;
          },
          set innerHTML(html) {
            children.length = 0;
            const s = String(html ?? '');
            const tagRe = /<(div|span|button|input|select|canvas|tbody|table|details|label|p|h4)\b([^>]*)>/gi;
            let m;
            while ((m = tagRe.exec(s))) {
              const tName = m[1].toLowerCase();
              const rawAttr = m[2];
              const a = {};
              const ds = {};
              for (const am of rawAttr.matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/gi)) {
                const key = am[1].toLowerCase();
                const val = am[2] ?? '';
                a[key] = val;
                if (key.startsWith('data-')) {
                  ds[key.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = val;
                }
              }
              const child = makeFakeNode(tName, a);
              child.dataset = ds;
              child.parentElement = node;
              children.push(child);
            }
          },
          get innerHTML() { return ''; },
        };
        for (const [k, v] of Object.entries(attrs)) {
          if (k.startsWith('data-')) node.dataset[k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = v;
        }
        return node;
      };

      globalThis.document.createElement = tag => makeFakeNode(tag);
      for (const s of SIMS) {
        const host = makeFakeNode('div');
        const cleanFns = [];
        const ctx = { clean: { add: fn => typeof fn === 'function' && cleanFns.push(fn) } };
        const ret = s.mount(host, ctx);
        assert.equal(typeof ret, 'function', `${s.id} mount bir temizlik fonksiyonu döndürmeli`);
        ret();
        cleanFns.forEach(fn => fn());
      }
    } finally {
      for (const h of timers) clearTimeout(h);
      globalThis.devicePixelRatio = prev.devicePixelRatio;
      globalThis.setTimeout = prev.setTimeout;
      globalThis.window = prev.window;
      globalThis.document = prev.document;
      globalThis.matchMedia = prev.matchMedia;
      globalThis.addEventListener = prev.addEventListener;
      globalThis.dispatchEvent = prev.dispatchEvent;
      globalThis.getComputedStyle = prev.getComputedStyle;
    }
  });
});
