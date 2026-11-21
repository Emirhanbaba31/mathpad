import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  G0, R_UNIV, R_AIR, SIGMA_SB, WIEN_B, MU_EARTH, R_EARTH,
  classifyGrashof, fourBarCrankRange, solveFourBar, solveSliderCrank, sampleLinkageCycle,
  sdofParams, sdofFRF, sdofFreeResponse, sdofStep,
  twoDofModal, twoDofFRF, denHartogTMD, twoDofStep,
  collide2DBodies, bodiesMomentumEnergy, rollingIncline,
  solveGearTrain, camLawUnit, computeCamProfile,
  solveShaftTorsion, solveHelicalSpring,
  armForwardKinematics, armInverseKinematics, armJacobian,
  ellipticK, pendulumPeriods, pendulumStep, physicalPendulum, gyroscopePrecession,
  waterSatByP, waterSuperheated, r134aSatByT, solveThermoCycle,
  GAS_SPECIES, maxwellBoltzmann, idealGasProcess,
  heat1DStep, heat1DInit, solveLaplace2D, solveCompositeWall,
  solveFin, solveHeatExchanger,
  colebrookFriction, solvePipeFlow, solvePumpSystem, solveVenturi,
  evalPotentialFlow, cylinderWithCirculation,
  solveSubmergedGate, solveBuoyancyStability,
  planckSpectral, blackbodySummary, viewFactorParallelPlates, radiationPlateExchange,
  orbitalElements, orbitStep, hohmannTransfer,
  isaAtmosphere, solveMultistageRocket, simulateVerticalLaunch,
  parseNaca4, generateNaca4, thinAirfoilZeroLift, evaluateAirfoil, airfoilPolarSweep,
  projectileVacuum, simulateProjectile, findOptimalProjectileAngle,
  solveFlightPerformance,
} from '../js/simlab-mech-core.js';

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
// FIELD: MAKİNE & DİNAMİK (Tests 1-8)
// =====================================================================

describe('1. Dört Çubuk & Krank-Biyel Mekanizması', () => {
  test('Grashof sınıflandırması (krank-sarkaç, çift krank, değişim noktalı, Grashof dışı)', () => {
    const cr = classifyGrashof(4, 1.5, 3.5, 3);
    assert.equal(cr.grashof, true);
    assert.equal(cr.fullCrank, true);
    assert.match(cr.type, /Krank-Sarkaç/);

    const dc = classifyGrashof(1.5, 3.5, 4, 3);
    assert.equal(dc.grashof, true);
    assert.equal(dc.fullCrank, true);
    assert.match(dc.type, /Çift Krank/);

    const cp = classifyGrashof(4, 2, 3, 3); // 2+4 = 3+3
    assert.match(cp.type, /Değişim Noktalı/);

    const ng = classifyGrashof(4, 2.5, 2.8, 2.0); // 2.0+4 = 6 > 2.5+2.8 = 5.3
    assert.equal(ng.grashof, false);
    assert.equal(ng.fullCrank, false);
  });

  test('Dört çubuk kapalı zincir geometrisi, açısal hız ve ivme sonlu farklarla uyumlu', () => {
    const p = { L1: 4, L2: 1.4, L3: 3.6, L4: 3.0, omega2: 3.0 };
    const th = 0.9;
    const s = solveFourBar({ ...p, theta2: th });
    assert.equal(s.ok, true);
    // Vector loop closure check
    approx(Math.hypot(s.B.x - s.A.x, s.B.y - s.A.y), p.L3, 1e-10, 'L3 uzunluğu');
    approx(Math.hypot(s.B.x - s.O4.x, s.B.y - s.O4.y), p.L4, 1e-10, 'L4 uzunluğu');

    // Finite-difference cross-check for omega3, omega4, alpha3, alpha4
    const dt = 1e-5;
    const sPlus = solveFourBar({ ...p, theta2: th + p.omega2 * dt });
    const sMinus = solveFourBar({ ...p, theta2: th - p.omega2 * dt });
    approx(s.omega3, (sPlus.theta3 - sMinus.theta3) / (2 * dt), 1e-4, 'omega3');
    approx(s.omega4, (sPlus.theta4 - sMinus.theta4) / (2 * dt), 1e-4, 'omega4');
    approx(s.alpha3, (sPlus.omega3 - sMinus.omega3) / (2 * dt), 1e-3, 'alpha3');
    approx(s.alpha4, (sPlus.omega4 - sMinus.omega4) / (2 * dt), 1e-3, 'alpha4');
  });

  test('Krank-biyel piston konumu, hızı ve ivmesi sonlu farklarla uyumlu', () => {
    const p = { r: 1.0, l: 3.2, offset: 0.2, omega2: 4.0 };
    const th = 1.1;
    const s = solveSliderCrank({ ...p, theta2: th });
    assert.equal(s.ok, true);
    approx(Math.hypot(s.B.x - s.A.x, s.B.y - s.A.y), p.l, 1e-10);
    const dt = 1e-5;
    const sp = solveSliderCrank({ ...p, theta2: th + p.omega2 * dt });
    const sm = solveSliderCrank({ ...p, theta2: th - p.omega2 * dt });
    approx(s.vB, (sp.xB - sm.xB) / (2 * dt), 1e-4, 'piston hızı');
    approx(s.aB, (sp.vB - sm.vB) / (2 * dt), 1e-3, 'piston ivmesi');
    const cyc = sampleLinkageCycle({ mode: 'slider', ...p }, 60);
    assert.ok(cyc.thetas.length > 50 && cyc.muMin > 40);
  });
});

describe('2. Titreşim (1-DOF)', () => {
  test('Doğal frekans, sönüm oranı, rezonans genliği ve iletilebilirlik geçiş noktası r = sqrt(2)', () => {
    const p = sdofParams({ m: 2, k: 200, c: 4 });
    approx(p.wn, 10, 1e-10);
    approx(p.cCrit, 40, 1e-10);
    approx(p.zeta, 0.1, 1e-10);

    // At resonance r=1: M = 1/(2*zeta) = 5, phase = -90 deg
    const res = sdofFRF(1.0, 0.1);
    approx(res.mag, 5.0, 1e-10);
    approx(res.phaseDeg, -90, 1e-10);

    // Transmissibility = 1 identically at r = sqrt(2) for EVERY damping ratio zeta!
    for (const z of [0.05, 0.25, 0.7, 1.5]) {
      approx(sdofFRF(Math.SQRT2, z).tr, 1.0, 1e-10, `r=sqrt(2), zeta=${z}`);
      assert.ok(sdofFRF(2.0, z).tr < 1.0, 'Yalıtım bölgesi TR < 1');
    }
  });

  test('Serbest titreşim analitik çözümü ve RK4 uyumu (az/kritik/aşırı sönümlü)', () => {
    const free = sdofFreeResponse({ m: 1, k: 100, c: 2, x0: 0.2, v0: 0, tMax: 2, n: 200 });
    let st = [0.2, 0];
    const dt = 0.005;
    for (let i = 0; i < 400; i++) st = sdofStep({ m: 1, k: 100, c: 2, mode: 'free' }, st, i * dt, dt);
    approx(st[0], free.xs[free.xs.length - 1], 1e-5, 'RK4 vs analitik t=2s');

    const crit = sdofFreeResponse({ m: 1, k: 100, c: 20, x0: 1, v0: 0, tMax: 1, n: 100 });
    approx(crit.xs[crit.xs.length - 1], (1 + 10) * Math.exp(-10), 1e-8);
    const over = sdofFreeResponse({ m: 1, k: 100, c: 30, x0: 1, v0: 0, tMax: 1, n: 100 });
    assert.ok(over.xs.every(x => x >= 0), 'Aşırı sönümlüde aşım yok');
  });
});

describe('3. İki Serbestlik Dereceli Sistem & TMD', () => {
  test('Simetrik 2-DOF özfrekanslar ve mod şekilleri (m1=m2=m, k1=k2=k3=k)', () => {
    // Classic textbook: w1 = sqrt(k/m), w2 = sqrt(3k/m), modes [1,1] and [1,-1]
    const mod = twoDofModal({ m1: 2, m2: 2, k1: 50, k2: 50, k3: 50 });
    approx(mod.w1, Math.sqrt(25), 1e-10);
    approx(mod.w2, Math.sqrt(75), 1e-10);
    approx(mod.mode1[0], 1, 1e-10);
    approx(mod.mode1[1], 1, 1e-10);
    approx(mod.mode2[0], 1, 1e-10);
    approx(mod.mode2[1], -1, 1e-10);
  });

  test('Sönümsüz Frahm titreşim yutucu anti-rezonans noktasında |X1| = 0', () => {
    const m1 = 10, k1 = 1000, m2 = 1, k2 = 100; // both w = 10 rad/s
    const frf = twoDofFRF({ m1, m2, k1, k2, k3: 0, c1: 0, c2: 0, F0: 50 }, 10);
    approx(frf.mag1, 0, 1e-10, 'Anti-rezonans sıfırı');
    approx(frf.mag2, 50 / k2, 1e-8, 'Yutucu kuvveti F0 = k2*X2 dengeler');

    // Den Hartog optimal parameters
    const dh = denHartogTMD(10, 1000, 0.1);
    approx(dh.fOpt, 1 / 1.1, 1e-10);
    approx(dh.zetaOpt, Math.sqrt((3 * 0.1) / (8 * 1.1)), 1e-10);
  });
});

describe('4. Rijit Cisim Çarpışması & Eğik Düzlemde Yuvarlanma', () => {
  test('2D çarpışmada momentum daima korunur; e=1 için kinetik enerji korunur', () => {
    const b1 = { x: 0, y: 0, vx: 5, vy: 1, m: 2, r: 0.5 };
    const b2 = { x: 0.9, y: 0.2, vx: -2, vy: 0.5, m: 3, r: 0.5 };
    const before = bodiesMomentumEnergy([b1, b2]);

    const el = collide2DBodies(b1, b2, 1.0);
    assert.equal(el.collided, true);
    const afterEl = bodiesMomentumEnergy([el.b1, el.b2]);
    approx(afterEl.px, before.px, 1e-10, 'px korunumu (e=1)');
    approx(afterEl.py, before.py, 1e-10, 'py korunumu (e=1)');
    approx(afterEl.ke, before.ke, 1e-10, 'KE korunumu (e=1)');

    const inel = collide2DBodies(b1, b2, 0.0);
    const afterInel = bodiesMomentumEnergy([inel.b1, inel.b2]);
    approx(afterInel.px, before.px, 1e-10, 'px korunumu (e=0)');
    approx(afterInel.py, before.py, 1e-10, 'py korunumu (e=0)');
    assert.ok(afterInel.ke < before.ke, 'Tam esnek olmayan çarpışmada enerji kaybı');
  });

  test('Eğik düzlem yarışı ivme sıralaması (blok > küre > disk > boş küre > halka) ve enerji korunumu', () => {
    const opts = { thetaDeg: 30, L: 10, muS: 0.8, m: 2, R: 0.2 };
    const blk = rollingIncline(0, opts);
    const sph = rollingIncline(2 / 5, opts);
    const dsk = rollingIncline(1 / 2, opts);
    const rng = rollingIncline(1, opts);
    approx(blk.a, G0 * 0.5, 1e-10);
    approx(sph.a, (5 / 7) * G0 * 0.5, 1e-10);
    approx(dsk.a, (2 / 3) * G0 * 0.5, 1e-10);
    approx(rng.a, 0.5 * G0 * 0.5, 1e-10);
    assert.ok(blk.tEnd < sph.tEnd && sph.tEnd < dsk.tEnd && dsk.tEnd < rng.tEnd);
    // Conservation of mechanical energy when rolling without slipping: K_trans + K_rot = m*g*h
    approx(dsk.kTrans + dsk.kRot, dsk.uDrop, 1e-8, 'Disk mekanik enerji korunumu');
    approx(rng.kTrans, rng.kRot, 1e-8, 'Halkada öteleme ve dönme enerjisi eşit');
  });
});

describe('5. Dişli Takımı & Kam Profili', () => {
  test('Basit, bileşik ve planet (Willis) dişli oranları', () => {
    const s2 = solveGearTrain({ type: 'simple', N1: 20, N2: 60, useIdler: false, rpmIn: 300 });
    approx(s2.ratio, -3, 1e-10);
    approx(s2.rpmOut, -100, 1e-10);
    const s3 = solveGearTrain({ type: 'simple', N1: 20, N2: 60, useIdler: true, Nid: 30, rpmIn: 300 });
    approx(s3.ratio, 3, 1e-10);
    approx(s3.rpmOut, 100, 1e-10);

    const comp = solveGearTrain({ type: 'compound', N1: 16, N2: 48, N3: 15, N4: 60, rpmIn: 1200 });
    approx(comp.ratio, 12, 1e-10);
    approx(comp.rpmOut, 100, 1e-10);

    // Planetary: Ns=20, Np=15 -> Nr=50; fixed ring -> ratio = 1 + 50/20 = 3.5
    const plan = solveGearTrain({ type: 'planetary', Ns: 20, Np: 15, fixed: 'ring', rpmIn: 700 });
    assert.equal(plan.Nr, 50);
    approx(plan.ratio, 3.5, 1e-10);
    approx(plan.rpmOut, 200, 1e-10);
  });

  test('Kam hareket yasaları sınır koşulları (sikloit ve 3-4-5 polinomda uçlarda ivme sıfır)', () => {
    for (const law of ['uniform', 'harmonic', 'cycloidal', 'poly345']) {
      approx(camLawUnit(law, 0).s, 0, 1e-12);
      approx(camLawUnit(law, 1).s, 1, 1e-12);
      approx(camLawUnit(law, 0.5).s, 0.5, 1e-12);
    }
    approx(camLawUnit('cycloidal', 0).a, 0, 1e-12);
    approx(camLawUnit('cycloidal', 1).a, 0, 1e-12);
    approx(camLawUnit('poly345', 0).v, 0, 1e-12);
    approx(camLawUnit('poly345', 0).a, 0, 1e-12);
    const prof = computeCamProfile({ law: 'cycloidal', lift: 20, riseDeg: 120, dwellHiDeg: 60, returnDeg: 120 });
    approx(prof.s[0], 0, 1e-9);
    approx(prof.s[150], 20, 1e-9); // inside upper dwell (150 deg)
    approx(prof.s[350], 0, 1e-9);
  });
});

describe('6. Mil Burulması & Helisel Yay', () => {
  test('Dolu ve içi boş mil burulma kayma gerilmesi ve dönme açısı', () => {
    // Solid steel shaft: D=0.04 m, L=1.0 m, G=80 GPa, T=500 N·m
    const s = solveShaftTorsion({ D: 0.04, d: 0, L: 1.0, G: 80e9, T: 500 });
    const Jexp = (Math.PI / 32) * Math.pow(0.04, 4);
    approx(s.J, Jexp, 1e-14);
    approx(s.tauMax, (16 * 500) / (Math.PI * Math.pow(0.04, 3)), 1e-4);
    approx(s.phiRad, (500 * 1.0) / (Jexp * 80e9), 1e-10);

    // Hollow shaft removes inner core with little J loss: d = D/2 retains 15/16 of J
    const h = solveShaftTorsion({ D: 0.04, d: 0.02, L: 1.0, G: 80e9, T: 500 });
    approx(h.J / s.J, 15 / 16, 1e-10);
  });

  test('Helisel yay rijitliği ve Wahl gerilme çarpanı (Shigley ders kitabı)', () => {
    // d=4 mm, D=32 mm -> C=8, Kw = 31/28 + 0.615/8 = 1.184018
    const sp = solveHelicalSpring({ d: 0.004, D: 0.032, Na: 10, G: 79.3e9, F: 150 });
    approx(sp.C, 8.0, 1e-10);
    approx(sp.Kw, 31 / 28 + 0.615 / 8, 1e-6);
    const kExp = (79.3e9 * Math.pow(0.004, 4)) / (8 * Math.pow(0.032, 3) * 10);
    approx(sp.k, kExp, 1e-4);
    approx(sp.deflection, 150 / kExp, 1e-8);
    approx(sp.tauWahl / sp.tauNominal, sp.Kw, 1e-10);
  });
});

describe('7. Robot Kol (2-DOF FK, IK & Jacobian)', () => {
  test('Ters kinematik ileri kinematiği tam geri verir; tekillikte det(J) = 0', () => {
    const L1 = 1.2, L2 = 0.9;
    const tx = 1.1, ty = 0.85;
    for (const elbowUp of [false, true]) {
      const ik = armInverseKinematics(L1, L2, tx, ty, elbowUp);
      assert.equal(ik.reachable, true);
      const fk = armForwardKinematics(L1, L2, ik.th1, ik.th2);
      approx(fk.ee.x, tx, 1e-10);
      approx(fk.ee.y, ty, 1e-10);
    }
    // Jacobian determinant identity: det(J) = L1 * L2 * sin(th2)
    const j = armJacobian(L1, L2, 0.7, Math.PI / 2);
    approx(j.det, L1 * L2, 1e-10);
    assert.equal(j.singular, false);

    const jSing = armJacobian(L1, L2, 0.4, 0);
    approx(jSing.det, 0, 1e-12);
    assert.equal(jSing.singular, true);
  });
});

describe('8. Sarkaç & Jiroskop', () => {
  test('Büyük açı sarkaç periyodu eliptik integral ve RK4 ile uyumlu', () => {
    approx(ellipticK(0), Math.PI / 2, 1e-12);
    const p90 = pendulumPeriods(1.0, Math.PI / 2, 9.80665);
    // Exact K(sin 45°) / (pi/2) ≈ 1.1803406
    approx(p90.ratio, 1.1803406, 1e-6);

    // Integrate half period from theta0 = pi/2 to -pi/2 via RK4
    let st = [Math.PI / 2, 0];
    const dt = 0.001;
    let t = 0;
    while (t < p90.Texact * 0.6) {
      const prevW = st[1];
      st = pendulumStep({ Leq: 1.0, g: 9.80665 }, st, dt);
      t += dt;
      if (t > 0.2 && prevW < 0 && st[1] >= 0) break;
    }
    approx(2 * t, p90.Texact, 0.005, 'RK4 periyodu vs AGM eliptik integral');
  });

  test('Fiziksel sarkaç (çubuk Leq = 2L/3) ve jiroskop presesyon hızı', () => {
    const rod = physicalPendulum({ shape: 'rod', m: 2, L: 1.5 });
    approx(rod.Leq, 1.0, 1e-10, 'Uçtan asılı çubukta Leq = 2L/3');
    const disk = physicalPendulum({ shape: 'disk', m: 2, R: 0.4 });
    approx(disk.Leq, 0.6, 1e-10, 'Kenardan asılı diskte Leq = 3R/2');

    // Gyroscope: Omega_p = m*g*r / (I_s * w_s)
    const g = gyroscopePrecession({ m: 1.0, R: 0.1, r: 0.2, rpm: 3000, shape: 'disk' });
    const Is = 0.5 * 1.0 * 0.01;
    const ws = (3000 * 2 * Math.PI) / 60;
    approx(g.omegaP, (1.0 * G0 * 0.2) / (Is * ws), 1e-10);
    assert.equal(g.isFastTop, true);
  });
});

// =====================================================================
// FIELD: TERMO & AKIŞKAN (Tests 9-16)
// =====================================================================

describe('9. Termodinamik Çevrimler', () => {
  test('Otto, Diesel, Brayton ve Carnot kapalı form verim formülleri', () => {
    const otto = solveThermoCycle({ type: 'otto', r: 9, gamma: 1.4, T1: 300, T3: 2200 });
    approx(otto.eff, 1 - Math.pow(9, -0.4), 1e-10, 'Otto verimi');
    approx(otto.wNet, otto.qIn - otto.qOut, 1e-10);
    assert.ok(otto.eff < otto.carnotEff);

    const diesel = solveThermoCycle({ type: 'diesel', r: 18, rc: 2.0, gamma: 1.4, T1: 300 });
    const expDiesel = 1 - Math.pow(18, -0.4) * ((Math.pow(2, 1.4) - 1) / (1.4 * (2 - 1)));
    approx(diesel.eff, expDiesel, 1e-10, 'Diesel verimi');

    const bray = solveThermoCycle({ type: 'brayton', rp: 10, gamma: 1.4, T1: 300, T3: 1400 });
    approx(bray.eff, 1 - Math.pow(10, -0.4 / 1.4), 1e-10, 'Brayton verimi');

    const carn = solveThermoCycle({ type: 'carnot', TL: 300, TH: 900, rIso: 2.5 });
    approx(carn.eff, 2 / 3, 1e-10, 'Carnot verimi');
  });

  test('Rankine (su buharı) ve R-134a buhar sıkıştırmalı soğutma ders kitabı doğrulaması', () => {
    // Çengel Ex. 10-1: Ideal Rankine, Pboil=3000 kPa, T3=350 °C, Pcond=75 kPa -> eta ≈ 26%, Pcond=10 kPa -> eta ≈ 34%
    const rk = solveThermoCycle({ type: 'rankine', Pboil: 3000, Pcond: 10, T3_C: 350 });
    relApprox(rk.states[2].h, 3116.1, 0.02, '3 MPa 350 °C buhar entalpisi');
    assert.ok(rk.eff > 0.31 && rk.eff < 0.37, `Rankine verimi makul aralıkta: ${rk.eff}`);
    assert.ok(rk.eff < rk.carnotEff, 'Carnot sınırının altında');
    assert.ok(rk.x4 > 0.7 && rk.x4 <= 1.0);

    // R-134a VCR: Tevap=-10 °C, Tcond=40 °C -> COP_R ≈ 4.0–4.2 < COP_Carnot (5.26)
    const vcr = solveThermoCycle({ type: 'vcr', Tevap: -10, Tcond: 40 });
    assert.ok(vcr.copR > 3.8 && vcr.copR < 4.5, `R-134a COP_R = ${vcr.copR}`);
    approx(vcr.copCarnot, 263.15 / 50, 1e-3);
    assert.ok(vcr.copR < vcr.copCarnot);
    approx(vcr.copHP, vcr.copR + 1, 1e-6);
  });
});

describe('10. İdeal Gaz & Kinetik Teori', () => {
  test('Termodinamik süreçlerde 1. yasa (Q = ΔU + W) ve Maxwell-Boltzmann hız oranları', () => {
    for (const proc of ['isothermal', 'adiabatic', 'isobaric', 'isochoric']) {
      const r = idealGasProcess({ process: proc, nMol: 2, T1: 300, V1: 0.03, V2: 0.06, T2Isochoric: 500, gamma: 1.4 });
      approx(r.Q, r.dU + r.W, 1e-6, `${proc} 1. yasa`);
    }
    const mb = maxwellBoltzmann(300, GAS_SPECIES.n2.M, 2500, 500);
    // Exact ratios: vMean/vp = sqrt(4/pi), vRms/vp = sqrt(3/2)
    approx(mb.vMean / mb.vp, Math.sqrt(4 / Math.PI), 1e-10);
    approx(mb.vRms / mb.vp, Math.sqrt(1.5), 1e-10);
    // Integral of PDF over [0, inf) ≈ 1
    const dv = mb.vs[1] - mb.vs[0];
    let area = 0;
    for (let i = 0; i < mb.pdf.length - 1; i++) area += 0.5 * (mb.pdf[i] + mb.pdf[i + 1]) * dv;
    approx(area, 1.0, 1e-3, 'Maxwell-Boltzmann normalizasyonu');
  });
});

describe('11. Isı İletimi (1D, 2D Laplace, Kompozit Duvar)', () => {
  test('1D geçici iletim sinüs modunun analitik sönümüne ve kararlı doğrusala yakınsaması', () => {
    const L = 1.0, N = 41, dx = L / (N - 1), alpha = 1e-4;
    const dt = 0.25 * (dx * dx) / alpha; // Fo = 0.25 <= 0.5
    let T = heat1DInit({ N, TL: 0, TR: 0, profile: 'sine' });
    const steps = 80;
    let last;
    for (let k = 0; k < steps; k++) {
      last = heat1DStep(T, { alpha, dx, dt, TL: 0, TR: 0 });
      T = last.T;
    }
    assert.equal(last.stable, true);
    approx(last.Fo, 0.25, 1e-12);
    const tTotal = steps * dt;
    const exactMid = 80 * Math.exp(-alpha * Math.PI * Math.PI * tTotal);
    relApprox(T[20], exactMid, 0.015, '1D sinüs modu analitik çözüm');
  });

  test('2D Laplace ortalama değer özelliği ve kompozit duvar seri direnç toplamı', () => {
    const sol = solveLaplace2D({ N: 25, Ttop: 100, Tbottom: 0, Tleft: 0, Tright: 0 });
    // Symmetry on square with 1 side at 100, 3 sides at 0 -> exact center = 25 °C!
    approx(sol.Tcenter, 25.0, 0.05, 'Kare levha merkez sıcaklığı tam 25 °C');

    const cw = solveCompositeWall({
      Tin: 20, Tout: 0, hi: 10, ho: 20, A: 1,
      layers: [{ L: 0.2, k: 1.0 }, { L: 0.05, k: 0.05 }],
    });
    // Rtot = 1/10 + 0.2/1 + 0.05/0.05 + 1/20 = 0.1 + 0.2 + 1.0 + 0.05 = 1.35
    approx(cw.Rtot, 1.35, 1e-10);
    approx(cw.qFlux, 20 / 1.35, 1e-8);
    approx(cw.temps[0], 20, 1e-10);
    approx(cw.temps[cw.temps.length - 1], 0, 1e-10);
  });
});

describe('12. Kanatçık & Isı Değiştirici', () => {
  test('Yalıtılmış kanatçık verimi tanh(mL)/(mL) ve ters akışlı eşanjör LMTD = ε-NTU tutarlılığı', () => {
    const fin = solveFin({ L: 0.1, t: 0.004, w: 0.05, k: 200, h: 40, Tb: 100, Tinf: 20, tip: 'adiabatic' });
    approx(fin.eta, Math.tanh(fin.mL) / fin.mL, 1e-10);
    assert.ok(fin.tipTemp > 20 && fin.tipTemp < 100);

    for (const flow of ['parallel', 'counter']) {
      const hx = solveHeatExchanger({ flow, Ch: 4000, Cc: 2500, Thi: 140, Tci: 20, UA: 3000 });
      // Verify Q = UA * LMTD identically!
      relApprox(hx.Q, 3000 * hx.lmtd, 1e-5, `${flow} Q = UA*LMTD`);
      // Energy balance Ch*(Thi-Tho) = Cc*(Tco-Tci) = Q
      approx(4000 * (140 - hx.Tho), hx.Q, 1e-6);
      approx(2500 * (hx.Tco - 20), hx.Q, 1e-6);
    }
    // Counter flow strictly beats parallel flow for same UA
    const pHX = solveHeatExchanger({ flow: 'parallel', Ch: 3000, Cc: 3000, Thi: 120, Tci: 20, UA: 3000 });
    const cHX = solveHeatExchanger({ flow: 'counter', Ch: 3000, Cc: 3000, Thi: 120, Tci: 20, UA: 3000 });
    assert.ok(cHX.eps > pHX.eps);
    approx(cHX.eps, 0.5, 1e-6, 'Balanced counter-flow NTU=1 -> eps=0.5');
  });
});

describe('13. Boru Akışı, Moody, Pompa & Venturi', () => {
  test('Colebrook-White denklemi tam sağlanır; laminerde f = 64/Re', () => {
    approx(colebrookFriction(1000, 0.001), 0.064, 1e-12);
    const Re = 2e5, rr = 0.0004;
    const f = colebrookFriction(Re, rr);
    const lhs = 1 / Math.sqrt(f);
    const rhs = -2 * Math.log10(rr / 3.7 + 2.51 / (Re * Math.sqrt(f)));
    approx(lhs, rhs, 1e-9, 'Colebrook özdeşliği');
  });

  test('Pompa-sistem kesişimi ve Venturi Bernoulli farkı', () => {
    const ps = solvePumpSystem({ H0: 40, aPump: 1000, dZ: 10, D: 0.1, L: 100, roughness: 0.0001, sumK: 3 });
    assert.equal(ps.feasible, true);
    approx(40 - 1000 * ps.Qop * ps.Qop, ps.Hop, 1e-5);
    assert.ok(ps.Hop > 10 && ps.Hop < 40);

    const ven = solveVenturi({ D1: 0.1, D2: 0.05, Q: 0.02, rho: 1000, Cd: 1.0 });
    approx(ven.V2 / ven.V1, 4.0, 1e-10, 'Süreklilik V2/V1 = (D1/D2)^2');
    approx(ven.dP, 0.5 * 1000 * (ven.V2 * ven.V2 - ven.V1 * ven.V1), 1e-6);
  });
});

describe('14. Potansiyel Akış & Kutta-Joukowski', () => {
  test('Sirkülasyonsuz silindirde Cp(0)=1, Cp(90°)=-3; Kutta-Joukowski kaldırma kuvveti', () => {
    const cyl0 = cylinderWithCirculation({ U: 10, R: 1, gamma: 0, rho: 1.225 });
    approx(cyl0.liftPerSpan, 0, 1e-12);
    approx(cyl0.cps[0], 1.0, 1e-10, 'Durma noktası Cp = 1');
    approx(cyl0.cps[45], -3.0, 1e-10, 'Tepe noktası Cp = -3');

    const cyl = cylinderWithCirculation({ U: 10, R: 1, gamma: 20, rho: 1.225 });
    approx(cyl.liftPerSpan, 1.225 * 10 * 20, 1e-10);
    approx(cyl.CL, 2.0, 1e-10);
    // Verify velocity at both stagnation points is near zero!
    for (const sp of cyl.stagPts) {
      const f = evalPotentialFlow(sp.x, sp.y, cyl.elements, 10);
      assert.ok(f.speed < 0.05, `Durma noktasında hız ~ 0 (elde edilen ${f.speed})`);
    }
  });
});

describe('15. Akışkan Statiği & Kaldırma Kararlılığı', () => {
  test('Batık dikey kapak basınç merkezi (hTop=0 için hP = 2L/3)', () => {
    const gate = solveSubmergedGate({ b: 2, L: 3, thetaDeg: 90, hTop: 0, rho: 1000 });
    approx(gate.hc, 1.5, 1e-10);
    approx(gate.hP, 2.0, 1e-10, 'Üçgen basınç prizması hP = 2L/3');
    approx(gate.FR, 1000 * G0 * 1.5 * 6, 1e-6);
  });

  test('Yüzen dikdörtgen gövde metasantr yüksekliği GM = KB + BM - KG', () => {
    // Wide barge: stable; tall narrow block: unstable
    const wide = solveBuoyancyStability({ B: 8, H: 2, L: 10, relDensity: 0.5, kgRatio: 0.5 });
    approx(wide.draft, 1.0, 1e-10);
    approx(wide.KB, 0.5, 1e-10);
    approx(wide.BM, 64 / 12, 1e-10);
    approx(wide.GM, 0.5 + 64 / 12 - 1.0, 1e-10);
    assert.equal(wide.stable, true);

    const tall = solveBuoyancyStability({ B: 1, H: 4, L: 10, relDensity: 0.5, kgRatio: 0.5 });
    assert.equal(tall.stable, false);
    assert.ok(tall.GM < 0);
  });
});

describe('16. Isı Işınımı (Planck, Wien, Stefan-Boltzmann, Görüş Faktörü)', () => {
  test('Wien kayma yasası, Planck tepe noktası ve Stefan-Boltzmann toplamı', () => {
    const T = 5778; // Sun surface
    const bb = blackbodySummary(T, 1.0);
    approx(bb.lambdaMaxUm, (WIEN_B / T) * 1e6, 1e-6);
    approx(bb.EbTotal, SIGMA_SB * Math.pow(T, 4), 1e-2);
    // Check numerical peak of Planck function matches Wien's law
    const lamPeak = WIEN_B / T;
    const pAt = planckSpectral(lamPeak, T);
    assert.ok(pAt > planckSpectral(lamPeak * 0.98, T) && pAt > planckSpectral(lamPeak * 1.02, T));
    // Sun visible fraction is ~43-45%
    assert.ok(bb.fVis > 0.40 && bb.fVis < 0.48, `Güneş görünür payı: ${bb.fVis}`);
  });

  test('Paralel levhalar görüş faktörü sınırları (L->0: F12->1, L>>W: F12->W*H/(pi*L^2))', () => {
    const fClose = viewFactorParallelPlates(10, 10, 0.01);
    assert.ok(fClose > 0.99);
    // Textbook square W=H=L (X=Y=1): exact F12 = 0.199825
    approx(viewFactorParallelPlates(1, 1, 1), 0.199825, 1e-5);
    // Far-field limit: F12 ≈ A / (pi * L^2)
    const fFar = viewFactorParallelPlates(1, 1, 100);
    relApprox(fFar, 1 / (Math.PI * 10000), 0.01);
    const ex = radiationPlateExchange({ W: 1, H: 1, L: 1, T1: 800, T2: 800 });
    approx(ex.Q12, 0, 1e-10);
  });
});

// =====================================================================
// FIELD: HAVACILIK & UZAY (Tests 17-21)
// =====================================================================

describe('17. Yörünge Mekaniği (Kepler & Hohmann)', () => {
  test('Dairesel yörünge, kaçış hızı v_esc = sqrt(2)*v_c ve RK4 enerji/açısal momentum korunumu', () => {
    const r0 = R_EARTH + 400e3;
    const vc = Math.sqrt(MU_EARTH / r0);
    const el = orbitalElements({ x: r0, y: 0, vx: 0, vy: vc });
    approx(el.e, 0, 1e-10);
    approx(el.a, r0, 1e-2);
    approx(el.vEsc / el.vCirc, Math.SQRT2, 1e-10);
    // ISS orbital period ~ 92.5 min
    assert.ok(el.period > 5400 && el.period < 5700);

    // Elliptic orbit energy & h conservation over 1 full period via RK4
    let st = [r0, 0, 0, vc * 1.15];
    const el0 = orbitalElements({ x: st[0], y: st[1], vx: st[2], vy: st[3] });
    const nSteps = 400;
    const dt = el0.period / nSteps;
    for (let i = 0; i < nSteps; i++) st = orbitStep(st, dt);
    const el1 = orbitalElements({ x: st[0], y: st[1], vx: st[2], vy: st[3] });
    relApprox(el1.eps, el0.eps, 1e-6, 'Özgül enerji korunumu');
    relApprox(el1.h, el0.h, 1e-6, 'Açısal momentum korunumu');
  });

  test('LEO (200 km) -> GEO (35786 km) Hohmann transferi ders kitabı değerleri', () => {
    const h = hohmannTransfer({ h1: 200e3, h2: 35786e3 });
    // Standard textbook: dv1 ≈ 2457 m/s, dv2 ≈ 1478 m/s, total ≈ 3935 m/s, t ≈ 5.26 hr
    assert.ok(h.dv1 > 2400 && h.dv1 < 2520, `dv1=${h.dv1}`);
    assert.ok(h.dv2 > 1440 && h.dv2 < 1520, `dv2=${h.dv2}`);
    assert.ok(h.tTransfer / 3600 > 5.15 && h.tTransfer / 3600 < 5.35);
  });
});

describe('18. Roket Denklemi & Dikey Fırlatma', () => {
  test('ISA atmosfer modeli deniz seviyesi ve 11 km tropopoz değerleri', () => {
    const sl = isaAtmosphere(0);
    approx(sl.T, 288.15, 1e-6);
    approx(sl.P, 101325, 1e-2);
    approx(sl.rho, 1.225, 1e-3);
    approx(sl.a, 340.29, 0.05);

    const tr = isaAtmosphere(11000);
    approx(tr.T, 216.65, 1e-6);
    relApprox(tr.P, 22632, 1e-3);
    relApprox(tr.rho, 0.3639, 2e-3);
  });

  test('Tsiolkovsky kademelendirme avantajı ve dikey fırlatma Δv bütçesi', () => {
    const ms = solveMultistageRocket({
      mPayload: 1000,
      stages: [
        { mProp: 40000, mStruct: 4000, Isp: 300 },
        { mProp: 10000, mStruct: 1000, Isp: 340 },
      ],
    });
    assert.ok(ms.totalDv > ms.sstoDv + 800, 'İki kademeli roket tek kademeliyi belirgin aşar');
    approx(ms.stages[0].dv, 300 * G0 * Math.log(56000 / 16000), 1e-6);

    const launch = simulateVerticalLaunch({ m0: 50000, mProp: 40000, Isp: 290, thrust: 850000, Cd: 0.35, area: 4 });
    // Energy/velocity budget: dvIdeal ≈ vBurnout + gravLoss + dragLoss
    relApprox(launch.vBurnout + launch.gravLoss + launch.dragLoss, launch.dvIdeal, 0.02, 'Δv kayıp bütçesi');
    assert.ok(launch.maxQ > 5000 && launch.maxQTime > 0 && launch.maxQTime < launch.tBurn);
  });
});

describe('19. Kanat Profili (NACA 4-Digit & İnce Kanat Teorisi)', () => {
  test('Simetrik NACA 0012 (α_L0 = 0, maks kalınlık = %12) ve kambur NACA 2412 (α_L0 ≈ -2.08°)', () => {
    const n0 = parseNaca4('0012');
    approx(thinAirfoilZeroLift(n0.m, n0.p), 0, 1e-12);
    const geom = generateNaca4(n0, 100);
    const maxThick = Math.max(...geom.upper.map((u, i) => u.y - geom.lower[i].y));
    approx(maxThick, 0.12, 0.002);

    const n24 = parseNaca4('2412');
    const aL0Deg = (thinAirfoilZeroLift(n24.m, n24.p) * 180) / Math.PI;
    // Abbott & von Doenhoff / Thin airfoil exact for NACA 2412: -2.077 deg
    approx(aL0Deg, -2.077, 0.08, 'NACA 2412 sıfır kaldırma açısı');

    const af2D = evaluateAirfoil({ ...n0, alphaDeg: 5, finiteWing: false });
    relApprox(af2D.CL, 2 * Math.PI * (5 * Math.PI / 180), 0.03, '2D ince kanat CL ≈ 2π α');
    const polar = airfoilPolarSweep({ ...n24, finiteWing: true, AR: 8 });
    assert.ok(polar.clMax > 1.1 && polar.ldMax > 10);
  });
});

describe('20. Atış Hareketi & Sürükleme', () => {
  test('Vakumda (Cd=0) RK4 analitik parabolle çakışır; sürüklemede optimum açı < 45°', () => {
    const vac = projectileVacuum({ v0: 50, angleDeg: 45, h0: 0 });
    approx(vac.range, (50 * 50) / G0, 1e-6);
    const sim0 = simulateProjectile({ v0: 50, angleDeg: 45, h0: 0, Cd: 0 });
    relApprox(sim0.range, vac.range, 1e-4, 'Cd=0 RK4 vs vakum');
    relApprox(sim0.tFlight, vac.tFlight, 1e-4);

    const simDrag = simulateProjectile({ v0: 50, angleDeg: 45, h0: 0, m: 0.2, Cd: 0.47, area: 0.005 });
    assert.ok(simDrag.range < vac.range * 0.7);
    const opt = findOptimalProjectileAngle({ v0: 50, h0: 0, m: 0.2, Cd: 0.47, area: 0.005, vWind: 0 });
    assert.ok(opt.optAngle < 44 && opt.optAngle > 25, `Sürüklemede optimum açı < 45°: ${opt.optAngle}`);
  });
});

describe('21. Uçuş Performansı & Breguet', () => {
  test('V_mp / V_md = 3^(-1/4), (L/D)_max = 1/(2*sqrt(Cd0*K)) ve D_p = D_i @ V_md', () => {
    const fp = solveFlightPerformance({ aircraft: 'prop', mass: 1200, S: 16, AR: 8, eOswald: 0.8, Cd0: 0.025, altM: 0, Vcruise: 55 });
    approx(fp.vMinPower / fp.vMinDrag, Math.pow(3, -0.25), 1e-10);
    approx(fp.ldMax, 1 / (2 * Math.sqrt(0.025 * fp.K)), 1e-10);
    // At V_md, induced drag equals parasite drag!
    const fpAtMd = solveFlightPerformance({ aircraft: 'prop', mass: 1200, S: 16, AR: 8, eOswald: 0.8, Cd0: 0.025, altM: 0, Vcruise: fp.vMinDrag });
    relApprox(fpAtMd.atCruise.Dp, fpAtMd.atCruise.Di, 1e-6, 'V_md hızında Dp = Di');
    relApprox(fpAtMd.atCruise.LD, fp.ldMax, 1e-6);
    assert.ok(fp.rangeMaxKm >= fp.rangeCruiseKm - 1e-6);
    assert.ok(fp.enduranceMaxHr >= fp.enduranceCruiseHr - 1e-6);

    const jet = solveFlightPerformance({ aircraft: 'jet', mass: 45000, S: 100, AR: 9, eOswald: 0.82, Cd0: 0.02, altM: 10000, Vcruise: 230, thrustSL: 140000 });
    assert.ok(jet.rangeMaxKm > 1500 && jet.enduranceMaxHr > 2);
  });
});

describe('22. Kontur / Renk Yardımcıları & simlab-mech.js Modül Sözleşmesi', () => {
  test('marchingSquares, blackbodyColorHex ve thermalColorRGB tutarlıdır', async () => {
    const { marchingSquares, blackbodyColorHex, thermalColorRGB } = await import('../js/simlab-mech-core.js');
    // Linear ramp grid z = x: contour at level 1.5 should yield vertical segments at x = 1.5
    const g = [
      [0, 1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2, 3],
    ];
    const segs = marchingSquares(g, 1.5);
    assert.equal(segs.length, 2);
    for (const [x1, , x2] of segs) {
      approx(x1, 1.5, 1e-10);
      approx(x2, 1.5, 1e-10);
    }
    assert.match(blackbodyColorHex(5778), /^#[0-9a-f]{6}$/);
    const rgb = thermalColorRGB(0.5);
    assert.equal(rgb.length, 3);
    assert.ok(rgb.every(v => v >= 0 && v <= 255));
  });

  test('SIMS sözleşmesi: 21 simülasyon (8 makine, 8 termo, 5 havacilik), geçerli id/ikon/başlık ve mount', async () => {
    const noop = () => {};
    const stubEl = () => ({
      dataset: {},
      classList: { contains: () => false, toggle: noop, add: noop, remove: noop },
      style: { setProperty: noop },
      append: noop, prepend: noop, remove: noop,
      setAttribute: noop, getAttribute: () => null,
      addEventListener: noop, removeEventListener: noop,
      querySelector: () => null, querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    });
    const prev = {
      setTimeout: globalThis.setTimeout,
      window: globalThis.window,
      document: globalThis.document,
      matchMedia: globalThis.matchMedia,
      addEventListener: globalThis.addEventListener,
      dispatchEvent: globalThis.dispatchEvent,
      getComputedStyle: globalThis.getComputedStyle,
    };
    const timers = [];
    try {
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

      const { SIMS } = await import('../js/simlab-mech.js');
      assert.ok(Array.isArray(SIMS), 'SIMS dizi olmalı');
      assert.equal(SIMS.length, 21, 'Toplam 21 simülasyon (8 makine + 8 termo + 5 havacilik)');

      assert.equal(SIMS.filter(s => s.field === 'makine').length, 8);
      assert.equal(SIMS.filter(s => s.field === 'termo').length, 8);
      assert.equal(SIMS.filter(s => s.field === 'havacilik').length, 5);

      const forbiddenIds = new Set([
        'dc', 'transient', 'phasor', 'filter', 'opamp', 'logic',
        'diode-rectifier', 'transistor-curves', 'power-electronics', 'three-phase-power',
        'transformer-motor', 'transmission-line', 'em-fields', 'antenna-pattern',
        'communications', 'digital-circuits', 'pid-control', 'root-locus',
        'bode-nyquist', 'state-space', 'signals-fourier', 'sampling-aliasing',
        'convolution', 'digital-filter', 'laplace-z',
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
    } finally {
      for (const h of timers) clearTimeout(h);
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
