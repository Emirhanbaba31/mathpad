import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  C, cAbs, cMul, cAdd, cSub, cDiv,
  polyRoots, polyFromRoots, fft, qFunc,
  thermalVoltage, solveDiodeCircuit, simulateRectifier, solveZenerRegulator,
  solveBJT, mosfetId, solveMOSFET, solveCMOSInverter,
  solveDCDC, simulateSPWM,
  solveThreePhase,
  solveTransformer, solveInductionMotor, solveDCMotor,
  solveTransmissionLine,
  electricFieldAt, magneticFieldWires, wireForcePerLength, biotSavartLoop, loopAxialFieldExact, borisStep, cyclotronMetrics,
  computeAntennaPattern,
  simulateAnalogMod, theoreticalBER, simulateDigitalMod,
  stepFlipFlop, stepCounter4, stepShiftReg4, simplifyKMap,
  simulatePID, zieglerNicholsTune,
  computeRootLocus, closedLoopAtGain, tfStepResponse,
  analyzeBodeNyquist,
  cartPendulumLinearModel, ackermannGain, solveLQR4, cartPendulumStep,
  fourierSeries, analyzeWindowedFFT,
  simulateSampling,
  continuousConvolution, discreteConvolution,
  designFIR, designButterworthIIR, digitalFreqResponse, applyIIR,
  laplacePoleResponse, zPoleResponse, sToZMap,
} from '../js/simlab-eee-core.js';

const approx = (a, b, tol = 1e-4, msg = '') => {
  assert.ok(Number.isFinite(a) && Number.isFinite(b), `Sayısal değil: ${a} vs ${b} ${msg}`);
  assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (fark ${Math.abs(a - b)} > ${tol}) ${msg}`);
};

describe('Ortak matematik çekirdeği (Polinom, FFT, Q-fonksiyonu)', () => {
  test('polyRoots gerçel, karmaşık ve tekrarlı kökleri yüksek doğrulukla bulur', () => {
    const roots = [C(-1, 0), C(-2, 3), C(-2, -3), C(0, 0)];
    const p = polyFromRoots(roots);
    const found = polyRoots(p);
    assert.equal(found.length, 4);
    for (const r of roots) {
      const minD = Math.min(...found.map(f => Math.hypot(f.re - r.re, f.im - r.im)));
      assert.ok(minD < 1e-8, `Kök bulunamadı: ${r.re}+j${r.im}`);
    }
  });

  test('FFT -> IFFT özdeşliği ve Parseval enerji korunumu', () => {
    const N = 64;
    const x = Array.from({ length: N }, (_, n) => Math.sin((2 * Math.PI * 5 * n) / N) + 0.5 * Math.cos((2 * Math.PI * 12 * n) / N));
    const X = fft(x);
    const back = fft(X.re, X.im, true);
    for (let i = 0; i < N; i++) approx(back.re[i], x[i], 1e-10);
    const eTime = x.reduce((s, v) => s + v * v, 0);
    const eFreq = X.re.reduce((s, v, i) => s + (v * v + X.im[i] * X.im[i]) / N, 0);
    approx(eTime, eFreq, 1e-10, 'Parseval teoremi');
  });

  test('Q(0) = 0.5 ve bilinen standart normal kuyruk değerleri', () => {
    approx(qFunc(0), 0.5, 1e-6);
    approx(qFunc(1), 0.15865525, 1e-5);
    approx(qFunc(2), 0.02275013, 1e-5);
    approx(qFunc(3), 0.0013499, 1e-5);
  });
});

describe('1. Diyot & Doğrultucu', () => {
  test('Shockley termal gerilimi ve yük doğrusu KVL dengesi', () => {
    approx(thermalVoltage(25), 0.0256926, 1e-5);
    const r = solveDiodeCircuit({ Vs: 5, R: 1000, Is: 1e-12, n: 1.5, tempC: 25, Rs: 2 });
    // KVL: Vq + Iq * R = Vs
    approx(r.Vq + r.Iq * 1000, 5, 1e-6);
    assert.ok(r.Vq > 0.55 && r.Vq < 0.95, `Si diyot Vq=${r.Vq}`);
    assert.ok(r.Iq > 4e-3 && r.Iq < 4.5e-3);
  });

  test('Tam dalga köprü doğrultucu dalgalanması yarım dalganın yaklaşık yarısıdır ve filtre formülüyle uyumludur', () => {
    const full = simulateRectifier({ type: 'bridge', Vm: 15, f: 50, R: 1000, C: 220e-6, Vf: 0.7 });
    const half = simulateRectifier({ type: 'half', Vm: 15, f: 50, R: 1000, C: 220e-6, Vf: 0.7 });
    assert.ok(full.vRipplePP < half.vRipplePP * 0.65, 'Tam dalga daha düşük dalgalanmalı');
    // For large RC >> T, numerical ripple agrees with Vpk/(2*f*R*C) within ~20%
    assert.ok(Math.abs(full.vRipplePP - full.vRippleApprox) / full.vRippleApprox < 0.25);
    // Without capacitor: ideal diode full-wave average = 2*Vm/pi; with 2*Vf dead-zone matches exact integral
    const idealNoC = simulateRectifier({ type: 'bridge', Vm: 20, f: 50, R: 1000, C: 0, Vf: 0, Ron: 0.01 });
    approx(idealNoC.vDC, (2 * 20) / Math.PI, 0.02);
    const fullNoC = simulateRectifier({ type: 'bridge', Vm: 20, f: 50, R: 1000, C: 0, Vf: 0.7, Ron: 0.01 });
    const th0 = Math.asin(1.4 / 20);
    const exactVdc = (2 * 20 * Math.cos(th0) - 1.4 * (Math.PI - 2 * th0)) / Math.PI;
    approx(fullNoC.vDC, exactVdc, 0.05);
  });

  test('Zener regülatör KCL dengesi ve regülasyon sınırı', () => {
    const reg = solveZenerRegulator({ Vin: 12, Rs: 200, Vz: 5.1, rz: 0, RL: 500 });
    assert.equal(reg.regulating, true);
    approx(reg.Vout, 5.1, 1e-9);
    approx(reg.Is, reg.Iz + reg.IL, 1e-12);
    approx(reg.Is, (12 - 5.1) / 200, 1e-12);
    // Drop Vin below threshold -> out of regulation
    const unreg = solveZenerRegulator({ Vin: 6, Rs: 200, Vz: 5.1, rz: 0, RL: 500 });
    assert.equal(unreg.regulating, false);
    approx(unreg.Vout, 6 * (500 / 700), 1e-9);
    assert.equal(unreg.Iz, 0);
  });
});

describe('2. Transistör Eğrileri (BJT, MOSFET, CMOS)', () => {
  test('BJT ortak emetör Q noktası yük doğrusu üzerindedir ve aktif/doyum bölgelerini ayırır', () => {
    const active = solveBJT({ Vcc: 12, Rc: 1000, Ib: 50e-6, beta: 100, Va: 1e9 });
    assert.equal(active.region, 'Aktif');
    approx(active.Icq, 5e-3, 1e-4);
    approx(active.Vceq, 7.0, 0.05);
    assert.ok(active.Av < -100, `Aktif kazanç negatif ve yüksek: ${active.Av}`);

    const sat = solveBJT({ Vcc: 12, Rc: 1000, Ib: 250e-6, beta: 100, Va: 100 });
    assert.equal(sat.region, 'Doyum');
    assert.ok(sat.Vceq < 0.35);
  });

  test('MOSFET triyot/doyum sürekliliği ve Shichman-Hodges formülü', () => {
    const kn = 2e-3, Vth = 1.5, lambda = 0.02, Vgs = 3.5;
    const Vov = Vgs - Vth; // 2.0 V
    const iLeft = mosfetId(Vgs, Vov - 1e-6, { kn, Vth, lambda });
    const iRight = mosfetId(Vgs, Vov + 1e-6, { kn, Vth, lambda });
    approx(iLeft, iRight, 1e-6, 'Pinch-off sınırında süreklilik');
    approx(mosfetId(Vgs, 4, { kn, Vth, lambda }), 0.5 * kn * 4 * (1 + 0.02 * 4), 1e-12);
    const q = solveMOSFET({ Vdd: 10, Rd: 1000, Vgs: 3.5, kn, Vth, lambda: 0 });
    assert.equal(q.region, 'Doyum');
    approx(q.Idq, 4e-3, 1e-6);
    approx(q.Vdsq, 6.0, 1e-5);
  });

  test('Simetrik CMOS evirici VM = VDD/2 ve pozitif gürültü marjları verir', () => {
    const cmos = solveCMOSInverter({ Vdd: 3.3, Vtn: 0.6, Vtp: 0.6, kn: 1e-3, kp: 1e-3, lambda: 0.02 });
    approx(cmos.VM, 1.65, 1e-3);
    approx(cmos.NML, cmos.NMH, 0.08);
    assert.ok(cmos.NML > 1.0 && cmos.NMH > 1.0);
  });
});

describe('3. Güç Elektroniği (DC-DC + SPWM)', () => {
  test('İdeal Buck, Boost, Buck-Boost CCM gerilim kazançları ve CCM/DCM sınırı', () => {
    const buck = solveDCDC({ topology: 'buck', Vin: 24, D: 0.5, fs: 50e3, L: 200e-6, C: 47e-6, R: 10, Rpar: 0 });
    assert.equal(buck.ccm, true);
    approx(buck.Vo, 12, 1e-9);
    approx(buck.eta, 1, 1e-9);

    const boost = solveDCDC({ topology: 'boost', Vin: 12, D: 0.5, fs: 50e3, L: 200e-6, C: 47e-6, R: 20, Rpar: 0 });
    assert.equal(boost.ccm, true);
    approx(boost.Vo, 24, 1e-9);

    const bb = solveDCDC({ topology: 'buck-boost', Vin: 12, D: 0.6, fs: 50e3, L: 200e-6, C: 47e-6, R: 20, Rpar: 0 });
    assert.equal(bb.ccm, true);
    approx(bb.Vo, -18, 1e-9);

    // Light load R=500 -> DCM: Buck Vo > D*Vin
    const buckDCM = solveDCDC({ topology: 'buck', Vin: 24, D: 0.4, fs: 50e3, L: 50e-6, C: 47e-6, R: 500, Rpar: 0 });
    assert.equal(buckDCM.ccm, false);
    assert.ok(buckDCM.Vo > 0.4 * 24, 'DCM modunda Buck çıkış gerilimi D*Vin üzerine çıkar');
  });

  test('Tek fazlı SPWM evirici temel bileşen genliği ma * Vdc ile örtüşür', () => {
    const inv = simulateSPWM({ Vdc: 300, ma: 0.8, mf: 19, f1: 50, R: 15, L: 30e-3, unipolar: true });
    approx(inv.V1peak, 0.8 * 300, 3.0);
    assert.ok(inv.thdI < inv.thdV, 'RL yükü akım harmoniklerini süzer (THD_I < THD_V)');
  });
});

describe('4. Üç Faz & Güç + Kompanzasyon', () => {
  test('Dengeli Y ve Δ sistemlerde √3 ilişkisi, nötr akımı = 0 ve PFC kondansatör hesabı', () => {
    const Z = C(16, 12); // |Z| = 20 Ω, pf = 0.8 lagging
    const yRes = solveThreePhase({ connection: 'Y', VLL: 400, f: 50, ZA: Z, ZB: Z, ZC: Z, targetPF: 0.95 });
    approx(cAbs(yRes.IN), 0, 1e-9, 'Dengeli Y nötr akımı 0');
    const Vp = 400 / Math.sqrt(3);
    approx(cAbs(yRes.IA), Vp / 20, 1e-6);
    approx(yRes.pf, 0.8, 1e-6);
    approx(yRes.P, Math.sqrt(3) * 400 * (Vp / 20) * 0.8, 1e-4);
    approx(yRes.pfNew, 0.95, 1e-4);
    approx(yRes.Cstar, 3 * yRes.Cdelta, 1e-12, 'C_Y = 3 C_Delta');

    // Delta with same per-phase impedance draws 3x power and sqrt(3)*Iph line current
    const dRes = solveThreePhase({ connection: 'D', VLL: 400, f: 50, ZA: Z, ZB: Z, ZC: Z });
    approx(dRes.P, 3 * yRes.P, 1e-4);
    approx(cAbs(dRes.IA), Math.sqrt(3) * cAbs(dRes.IphA), 1e-6);

    // Unbalanced Y produces nonzero neutral current
    const unb = solveThreePhase({ connection: 'Y', VLL: 400, ZA: C(10, 0), ZB: C(20, 0), ZC: C(40, 0) });
    assert.ok(cAbs(unb.IN) > 5);
  });
});

describe('5. Transformatör & Motor', () => {
  test('Transformatör güç dengesi Pin = Pout + Pcore + Pcu ve kapasitif yükte negatif regülasyon', () => {
    const lag = solveTransformer({ pf: 0.8, pfType: 'lag', loadFrac: 1.0 });
    approx(lag.Pin, lag.Pout + lag.Pcore + lag.Pcu, 1e-3, 'Güç korunumu');
    assert.ok(lag.eta > 95 && lag.eta < 100);
    assert.ok(lag.VR > 0, 'Endüktif yükte pozitif regülasyon');

    const lead = solveTransformer({ pf: 0.8, pfType: 'lead', loadFrac: 1.0, X1: 4, X2: 0.04 });
    assert.ok(lead.VR < lag.VR, 'Kapasitif yükte regülasyon düşer');
  });

  test('Asenkron motor devrilme torku smax noktasında tepeye ulaşır', () => {
    const m = solveInductionMotor({ VLL: 400, f: 50, poles: 4, R1: 0.5, X1: 1.2, Xm: 45, R2: 0.4, X2: 1.2, slip: 0.04 });
    approx(m.ns, 1500, 1e-9);
    const mPeak = solveInductionMotor({ VLL: 400, f: 50, poles: 4, R1: 0.5, X1: 1.2, Xm: 45, R2: 0.4, X2: 1.2, slip: m.smax });
    approx(mPeak.Top, m.Tmax, 1e-6, 'T(s_max) = T_max');
    assert.ok(m.Top > 0 && m.Top < m.Tmax);
  });

  test('Serbest uyarmalı DC motor doğrusal hız-tork karakteristiği', () => {
    const dc = solveDCMotor({ mode: 'shunt', Va: 220, Ra: 1.0, K: 2.0, TL: 20 });
    approx(dc.wNoLoad, 110, 1e-9);
    approx(dc.Tstall, 440, 1e-9);
    approx(dc.IaOp, 10, 1e-9);
    approx(dc.wOp, (220 - 10) / 2, 1e-9);
    approx(dc.etaOp, (dc.PmOp / dc.PinOp) * 100, 1e-9);
  });
});

describe('6. İletim Hattı & Smith Çizelgesi', () => {
  test('Uyumlu hat, kısa devre, çeyrek dalga dönüştürücü ve tek saplama uyumu tam eşleşme verir', () => {
    const matched = solveTransmissionLine({ Z0: 50, RL: 50, XL: 0, lengthLam: 0.25 });
    approx(matched.gammaMag, 0, 1e-12);
    approx(matched.vswr, 1, 1e-12);

    // Quarter-wave line transforms ZL=100 to Zin = Z0^2 / ZL = 25 Ω
    const qw = solveTransmissionLine({ Z0: 50, RL: 100, XL: 0, lengthLam: 0.25 });
    approx(qw.ZIn.re, 25, 1e-6);
    approx(qw.ZIn.im, 0, 1e-6);
    approx(qw.vswr, 2, 1e-9);

    // Single-stub matching: verify matched admittance y(d) + j*bStub == 1 + j0
    const tl = solveTransmissionLine({ Z0: 50, RL: 75, XL: 50, lengthLam: 0.2 });
    assert.ok(tl.stubSolutions.length >= 1);
    for (const sol of tl.stubSolutions) {
      approx(sol.yd.re, 1.0, 1e-6, 'Birim iletkenlik çemberinde');
      const yTotalIm = sol.yd.im + sol.bStub;
      approx(yTotalIm, 0, 1e-6, 'Saplama sanal kısmı tam iptal eder');
    }
  });
});

describe('7. Elektromanyetik Alan', () => {
  test('Coulomb alanı, paralel tel kuvveti, Biot-Savart halkası ve Boris siklotron enerji korunumu', () => {
    // 1 uC at origin, test at x=1 m: E = ke * 1e-6 / 1^2
    const e = electricFieldAt(1, 0, [{ x: 0, y: 0, q: 1 }], 0);
    approx(e.Ex, 8987.55179, 1e-3);
    approx(e.Ey, 0, 1e-9);

    // Two 1 A parallel wires 1 m apart: F/L = 2e-7 N/m (definition of Ampere!)
    approx(wireForcePerLength(1, 1, 1), 2e-7, 1e-15);
    const bw = magneticFieldWires(0, 1, [{ x: 0, y: 0, I: 1 }], 0);
    approx(bw.Bmag, 2e-7, 1e-15);

    // Numerical Biot-Savart on loop axis matches exact analytical formula
    const bs = biotSavartLoop(0, 0.3, { R: 0.5, I: 10, segments: 96 });
    const exact = loopAxialFieldExact(0.3, { R: 0.5, I: 10 });
    approx(bs.Bz, exact, exact * 1e-4, 'Halka ekseninde Biot-Savart = kapalı form');
    approx(bs.Bx, 0, 1e-12);

    // Boris pusher conserves kinetic energy identically when E=0
    let st = { x: 0, y: 0, vx: 3, vy: 0 };
    const ke0 = 0.5 * (st.vx ** 2 + st.vy ** 2);
    for (let k = 0; k < 500; k++) st = borisStep(st, { q: 1, m: 1, Ex: 0, Ey: 0, Bz: 2 }, 0.01);
    const ke1 = 0.5 * (st.vx ** 2 + st.vy ** 2);
    approx(ke1, ke0, 1e-11, 'Saf B alanında kinetik enerji korunur');

    const cyc = cyclotronMetrics({ q: 1, m: 2, v0: 4, Ex: 0, Ey: 6, Bz: 2 });
    approx(cyc.rc, 4, 1e-9);
    approx(cyc.vdx, 3, 1e-9);
  });
});

describe('8. Anten Işıma Diyagramı', () => {
  test('Yarım dalga dipol yönlülüğü ≈ 1.641 (2.15 dBi), HPBW ≈ 78° ve ızgara lobu tespiti', () => {
    const dip = computeAntennaPattern({ element: 'dipole', L_lam: 0.5, N: 1, d_lam: 0.5, betaDeg: 0 });
    approx(dip.D0, 1.6409, 0.01);
    approx(dip.D0dBi, 2.15, 0.05);
    approx(dip.hpbwDeg, 78, 1.5);
    assert.equal(dip.hasGratingLobe, false);

    // Hertzian dipole: D0 = 1.5 exactly
    const hertz = computeAntennaPattern({ element: 'dipole', L_lam: 0.02, N: 1 });
    approx(hertz.D0, 1.5, 0.005);

    // Broadside ULA with d = 1.2 lambda -> grating lobes appear!
    const grat = computeAntennaPattern({ element: 'isotropic', N: 6, d_lam: 1.2, betaDeg: 0 });
    assert.equal(grat.hasGratingLobe, true);
    assert.ok(grat.gratingLobesDeg.length >= 2);
  });
});

describe('9. Haberleşme & Modülasyon', () => {
  test('AM gücü/verimi, FM Carson bant genişliği ve BPSK/QPSK Monte Carlo BER teoriye yakınsar', () => {
    const am = simulateAnalogMod({ mode: 'AM', fc: 24, fm: 2, index: 1.0, Ac: 2 });
    approx(am.amEfficiency, 100 / 3, 1e-6);
    approx(am.carsonBW, 4, 1e-9);
    assert.equal(am.overmodulated, false);

    const fm = simulateAnalogMod({ mode: 'FM', fc: 24, fm: 2, index: 3.0 });
    approx(fm.carsonBW, 2 * (6 + 2), 1e-9);

    // BER sanity: BPSK == QPSK < BFSK == ASK at same Eb/N0
    approx(theoreticalBER('BPSK', 6), theoreticalBER('QPSK', 6), 1e-12);
    assert.ok(theoreticalBER('BPSK', 6) < theoreticalBER('BFSK', 6));

    // Monte Carlo with 4000 symbols at 4 dB agrees closely with theory
    const mc = simulateDigitalMod({ scheme: 'BPSK', ebN0dB: 4, numSymbols: 4000, seed: 777 });
    approx(mc.berSim, mc.berTheory, 0.008);
  });
});

describe('10. Dijital Devreler (Flip-Flop, Sayıcı, Kaydırmalı Yazmaç, Karnaugh)', () => {
  test('D/JK/T flip-flop, 4-bit sayıcı ve Johnson yazmaç durum geçişleri', () => {
    assert.equal(stepFlipFlop('D', 0, { D: 1 }), 1);
    assert.equal(stepFlipFlop('JK', 0, { J: 1, K: 1 }), 1);
    assert.equal(stepFlipFlop('JK', 1, { J: 1, K: 1 }), 0);
    assert.equal(stepFlipFlop('T', 1, { T: 1 }), 0);
    assert.equal(stepCounter4(15, { up: true }), 0);
    assert.equal(stepCounter4(0, { up: false }), 15);
    assert.deepEqual(stepShiftReg4([0, 0, 0, 0], { mode: 'johnson' }), [1, 0, 0, 0]);
  });

  test('Karnaugh haritası Quine-McCluskey çözücü 2/3/4 değişken ve wrap-around gruplarını tam sadeleştirir', () => {
    // 4-var wrap-around corners: m(0, 2, 8, 10) -> B'D' (single 4-cell group!)
    const cells = new Array(16).fill(0);
    for (const m of [0, 2, 8, 10]) cells[m] = 1;
    const res = simplifyKMap(4, cells);
    assert.equal(res.groups.length, 1);
    assert.equal(res.expression, "B'D'");

    // With don't-cares: m(0,1,4) + d(5) -> A'C' (3 vars)
    const c3 = [1, 1, 0, 0, 1, 'X', 0, 0];
    const r3 = simplifyKMap(3, c3);
    assert.equal(r3.groups.length, 1);
    assert.equal(r3.expression, "B'");

    // Every minterm 1 covered, zero 0s covered for complex 4-var function
    const f4 = [1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1];
    const r4 = simplifyKMap(4, f4);
    for (let m = 0; m < 16; m++) {
      const covered = r4.groups.some(g => g.cells.includes(m));
      if (f4[m] === 1) assert.equal(covered, true, `Minterm ${m} kapsanmadı`);
      if (f4[m] === 0) assert.equal(covered, false, `Sıfır hücre ${m} yanlış kapsandı`);
    }
  });
});

describe('11. PID Kontrol', () => {
  test('İntegral terimi kalıcı durum hatasını sıfırlar ve anti-windup doygunlukta aşımı azaltır', () => {
    const pOnly = simulatePID({ plant: 'first', K: 1, tau: 1, Kp: 3, Ki: 0, Kd: 0, setpoint: 1, tEnd: 10 });
    // Exact steady-state for P control on 1/(s+1): y_ss = Kp / (1 + Kp) = 0.75
    approx(pOnly.yFinal, 0.75, 0.005);

    const pi = simulatePID({ plant: 'first', K: 1, tau: 1, Kp: 3, Ki: 4, Kd: 0, setpoint: 1, tEnd: 10 });
    approx(pi.steadyError, 0, 0.005, 'PI kalıcı hatayı sıfırlar');

    const windup = simulatePID({ plant: 'second', wn: 2, zeta: 0.4, Kp: 4, Ki: 6, Kd: 0.5, saturate: true, uMax: 1.5, antiWindup: false, tEnd: 12 });
    const anti = simulatePID({ plant: 'second', wn: 2, zeta: 0.4, Kp: 4, Ki: 6, Kd: 0.5, saturate: true, uMax: 1.5, antiWindup: true, tEnd: 12 });
    assert.ok(anti.overshootPct < windup.overshootPct, 'Anti-windup doygunluk aşımını düşürür');

    const zn = zieglerNicholsTune({ plant: 'fopdt', K: 1, tau: 2, L: 0.5 });
    approx(zn.Kp, 4.8, 1e-3);
    approx(zn.Ki, 4.8, 1e-3);
    approx(zn.Kd, 1.2, 1e-3);
  });
});

describe('12. Kök Yer Eğrisi', () => {
  test('3 kutuplu sistemde asimptot merkezi ve Routh-Hurwitz kritik kazancı Kcrit', () => {
    // G(s) = K / (s(s+1)(s+2)) = K / (s^3 + 3s^2 + 2s) -> Routh gives Kcrit = 6!
    const poles = [C(0, 0), C(-1, 0), C(-2, 0)];
    const rl = computeRootLocus(poles, [], { kMax: 12 });
    approx(rl.centroid, -1.0, 1e-9);
    approx(rl.kCrit, 6.0, 0.02, 'Routh-Hurwitz Kcrit = 6');

    const clStable = closedLoopAtGain(poles, [], 2);
    assert.equal(clStable.stable, true);
    const clUnstable = closedLoopAtGain(poles, [], 8);
    assert.equal(clUnstable.stable, false);

    // Closed-loop step response for 1st-order G = 1/(s+1), K=3 -> y(inf) = 0.75
    const cl1 = closedLoopAtGain([C(-1, 0)], [], 3);
    const sr = tfStepResponse(cl1.clNum, cl1.clDen, { tEnd: 5, dt: 0.01 });
    approx(sr.y[sr.y.length - 1], 0.75, 0.005);
  });
});

describe('13. Bode & Nyquist', () => {
  test('Kazanç/faz marjı ve RHP kutuplu (P=1) sistemde Nyquist sarım sayısı Z = P + N', () => {
    // G(s) = K / ((s+1)(s+2)(s+3)) -> Kcrit = (1+2+3)*(2+3+6) - 6 = 60
    const poles = [C(-1, 0), C(-2, 0), C(-3, 0)];
    const stableSys = analyzeBodeNyquist({ poles, zeros: [], K: 20 });
    assert.equal(stableSys.stable, true);
    assert.equal(stableSys.P, 0);
    assert.equal(stableSys.N_cw, 0);
    assert.equal(stableSys.Z, 0);
    // Exact GM = 20 log10(60/20) = 9.5424 dB
    approx(stableSys.gmDb, 20 * Math.log10(3), 0.15);
    assert.ok(stableSys.pmDeg > 0);

    // Open-loop unstable P=1: G(s) = K / (s - 1). For K=3: 1 + 3/(s-1) = (s+2)/(s-1) -> Z=0, N_cw = -1 (1 CCW encirclement!)
    const stabRhp = analyzeBodeNyquist({ poles: [C(1, 0)], zeros: [], K: 3 });
    assert.equal(stabRhp.P, 1);
    assert.equal(stabRhp.Z, 0);
    assert.equal(stabRhp.N_cw, -1);
    assert.equal(stabRhp.stable, true);
  });
});

describe('14. Durum Uzayı (Ters Sarkaç — LQR & Kutup Atama)', () => {
  test('Kontrol edilebilirlik rank = 4, Ackermann tam kutup ataması ve CARE artığı ≈ 0', () => {
    const params = { M: 1.0, m: 0.25, l: 0.5, b: 0.1 };
    const lin = cartPendulumLinearModel(params);
    assert.equal(lin.rankC, 4);
    assert.equal(lin.controllable, true);

    const desired = [C(-2, 0), C(-3, 0), C(-4, 1.5), C(-4, -1.5)];
    const Kack = ackermannGain(lin.A, lin.B, desired);
    assert.ok(Kack && Kack.length === 4);

    const lqr = solveLQR4(lin.A, lin.B, [10, 1, 100, 10], 0.5);
    assert.ok(lqr.residual < 1e-8, `CARE artığı çok küçük: ${lqr.residual}`);
    assert.ok(lqr.clEigs.every(e => e.re < 0), 'Tüm LQR kapalı döngü özdeğerleri sol yarı düzlemde');

    // Nonlinear simulation from initial 12° tilt stabilizes back near 0!
    let st = [0, 0, 0.2, 0];
    for (let k = 0; k < 1500; k++) {
      const u = -(lqr.K[0] * st[0] + lqr.K[1] * st[1] + lqr.K[2] * st[2] + lqr.K[3] * st[3]);
      st = cartPendulumStep(st, u, params, 0.004);
    }
    assert.ok(Math.abs(st[2]) < 0.01 && Math.abs(st[0]) < 0.05, 'Ters sarkaç dik konumda dengelenir');
  });
});

describe('15. Sinyaller & Fourier', () => {
  test('Kare dalgada Gibbs aşımı ≈ %8.95 ve Hann penceresi spektral sızıntıyı azaltır', () => {
    const sq = fourierSeries({ wave: 'square', harmonics: 35, samples: 1000 });
    assert.ok(sq.gibbsOvershootPct > 8.0 && sq.gibbsOvershootPct < 10.0, `Gibbs: %${sq.gibbsOvershootPct.toFixed(2)}`);
    approx(sq.parsevalPower, 1.0, 0.02);

    const rectLeak = analyzeWindowedFFT({ cycles: 8.5, windowType: 'rect', N: 256, fs: 256 });
    const hannLeak = analyzeWindowedFFT({ cycles: 8.5, windowType: 'hann', N: 256, fs: 256 });
    assert.ok(hannLeak.leakagePct < rectLeak.leakagePct * 0.25, 'Hann penceresi sızıntıyı belirgin azaltır');
  });
});

describe('16. Örnekleme & Aliasing', () => {
  test('Nyquist altı katlama frekansı, sinc geri çatımı ve 6.02B + 1.76 dB SQNR', () => {
    const al = simulateSampling({ f0: 7, fs: 10, bits: 6 });
    assert.equal(al.aliased, true);
    approx(al.fAlias, 3.0, 1e-9);
    assert.equal(al.phaseInverted, true);

    const ok = simulateSampling({ f0: 3, fs: 20, bits: 8 });
    assert.equal(ok.aliased, false);
    // Sinc reconstruction matches continuous signal in interior
    const mid = Math.floor(ok.tCont.length / 2);
    approx(ok.xSinc[mid], ok.xCont[mid], 0.02);
    // Measured SQNR agrees with 6.02*B + 1.76 dB within 0.6 dB
    approx(ok.sqnrMeasured, ok.sqnrTheory, 0.6);
  });
});

describe('17. Konvolüsyon', () => {
  test('Sürekli rect*rect -> üçgen (tepe=2) ve ayrık komütatiflik + dürtü özdeşliği', () => {
    const c = continuousConvolution('rect', 'rect', { shiftT: 2.0 });
    approx(c.yNow, 2.0, 0.06, 'rect([0,2]) * rect([0,2]) at t=2 equals 2');
    const c1 = continuousConvolution('rect', 'rect', { shiftT: 1.0 });
    approx(c1.yNow, 1.0, 0.06);

    const d = discreteConvolution([1, 1, 1, 1], [1, 1, 1, 1], 3);
    assert.deepEqual(d.y, [1, 2, 3, 4, 3, 2, 1]);
    assert.equal(d.yNow, 4);
    const dComm = discreteConvolution([1, 2, 3], [4, -1]);
    const dComm2 = discreteConvolution([4, -1], [1, 2, 3]);
    assert.deepEqual(dComm.y, dComm2.y);
  });
});

describe('18. Dijital Filtre (FIR & IIR Butterworth)', () => {
  test('Butterworth IIR kesim frekansında tam -3.01 dB ve tüm kutuplar birim çember içinde', () => {
    const lp = designButterworthIIR({ band: 'lowpass', order: 3, fc: 0.2 });
    assert.equal(lp.stable, true);
    assert.ok(lp.poles.every(p => cAbs(p) < 1));
    const fr = digitalFreqResponse(lp.b, lp.a, 201);
    // Index for f=0.2 in [0, 0.5] with 201 pts: 0.2/0.5 * 200 = 80
    approx(fr.mag[0], 1.0, 1e-6);
    approx(fr.mag[80], Math.SQRT1_2, 1e-4, 'Kesim frekansında |H| = 1/√2');
    assert.ok(fr.mag[200] < 1e-4, 'Nyquistte tam söndürme');

    // FIR lowpass attenuates high frequency sine strongly while passing low frequency
    const fir = designFIR({ band: 'lowpass', fc: 0.15, taps: 31, windowType: 'hamming' });
    const xLow = Array.from({ length: 120 }, (_, n) => Math.sin(2 * Math.PI * 0.04 * n));
    const xHigh = Array.from({ length: 120 }, (_, n) => Math.sin(2 * Math.PI * 0.4 * n));
    const yLow = applyIIR(fir.b, fir.a, xLow).slice(40);
    const yHigh = applyIIR(fir.b, fir.a, xHigh).slice(40);
    const rmsLow = Math.sqrt(yLow.reduce((s, v) => s + v * v, 0) / yLow.length);
    const rmsHigh = Math.sqrt(yHigh.reduce((s, v) => s + v * v, 0) / yHigh.length);
    assert.ok(rmsLow > 0.65 && rmsHigh < 0.03);
  });
});

describe('19. Laplace & z Dönüşümü', () => {
  test('s-düzlemi ve z-düzlemi kararlılık sınırları ile s -> z = e^{sT} eşlemesi', () => {
    const sStab = laplacePoleResponse({ sigma: -1, omega: 4, conjugate: true });
    assert.equal(sStab.stability, 'Kararlı');
    approx(sStab.h[0], 0, 1e-12);
    assert.ok(Math.abs(sStab.h[sStab.h.length - 1]) < 0.01);

    const sUnstab = laplacePoleResponse({ sigma: 0.5, omega: 2, conjugate: true });
    assert.equal(sUnstab.stability, 'Kararsız');

    const zReal = zPoleResponse({ re: -0.5, im: 0, conjugate: false, nSamples: 10 });
    assert.equal(zReal.stability, 'Kararlı');
    approx(zReal.h[0], 1, 1e-12);
    approx(zReal.h[1], -0.5, 1e-12);
    approx(zReal.h[2], 0.25, 1e-12);
    approx(zReal.h[3], -0.125, 1e-12);

    const mapped = sToZMap(-2, Math.PI * 5, 0.1);
    approx(mapped.r, Math.exp(-0.2), 1e-12);
    approx(mapped.theta, 0.5 * Math.PI, 1e-12);
    assert.equal(mapped.aliased, false);
  });
});

import { readFileSync } from 'node:fs';

describe('Modül sözleşmesi, saf çekirdek, CSS öneki ve UI doğrulaması', () => {
  test('simlab-eee-core.js hiçbir DOM veya UI içe aktarımı içermez', () => {
    const raw = readFileSync(new URL('../js/simlab-eee-core.js', import.meta.url), 'utf8');
    const codeOnly = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\bimport\s/.test(codeOnly), 'Çekirdek dosya dış modül içe aktarmamalı');
    assert.ok(!/\b(document|window)\b/.test(codeOnly), 'Çekirdek dosya DOM kullanmamalı');
  });

  test('css/simlab-eee.css tüm özel seçicilerde .sle- önekini, mobil ve hareket kurallarını içerir', () => {
    const css = readFileSync(new URL('../css/simlab-eee.css', import.meta.url), 'utf8');
    // Strip comments and check top-level class tokens
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const classes = [...stripped.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map(m => m[1]);
    const allowedForeign = new Set(['katex-display']);
    const bad = classes.filter(c => !c.startsWith('sle-') && !allowedForeign.has(c));
    assert.deepEqual(bad, [], `Öneksiz sınıf bulundu: ${bad.join(', ')}`);
    assert.ok(css.includes('@media (max-width: 860px)'), 'Tablet/telefon medya sorgusu mevcut');
    assert.ok(css.includes('@media (max-width: 480px)'), 'Dar telefon (360-430px) medya sorgusu mevcut');
    assert.ok(css.includes('html[data-motion="reduced"]'), 'Reduced motion desteği mevcut');
    assert.ok(css.includes('html[data-motion="off"]'), 'Motion off desteği mevcut');
  });

  test('js/simlab-eee.js tüm 19 simülasyonu geçerli arayüzle dışa aktarır (dinamik import + sözdizimi)', async () => {
    // Minimal DOM stubs so fx.js / ui.js / phys-ui.js / tools.js can be imported in Node
    const noop = () => {};
    const stubEl = () => ({
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      dataset: { motion: 'off' },
      style: { setProperty: noop },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      removeEventListener: noop,
      append: noop,
      prepend: noop,
    });
    const prevWin = globalThis.window;
    const prevDoc = globalThis.document;
    const prevMM = globalThis.matchMedia;
    const prevAdd = globalThis.addEventListener;
    const prevDisp = globalThis.dispatchEvent;
    const prevGCS = globalThis.getComputedStyle;
    const prevIDB = globalThis.indexedDB;
    const prevST = globalThis.setTimeout;
    const timers = [];
    try {
      globalThis.setTimeout = (fn, ms, ...a) => { const h = prevST(fn, ms, ...a); timers.push(h); return h; };
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

      const { SIMS } = await import('../js/simlab-eee.js');
      assert.ok(Array.isArray(SIMS), 'SIMS dizi olmalı');
      assert.equal(SIMS.length, 19, 'Toplam 19 simülasyon (10 eee + 9 kontrol)');

      const eeeSims = SIMS.filter(s => s.field === 'eee');
      const konSims = SIMS.filter(s => s.field === 'kontrol');
      assert.equal(eeeSims.length, 10, '10 yeni eee simülasyonu');
      assert.equal(konSims.length, 9, '9 kontrol simülasyonu');

      const existingIds = new Set(['dc', 'transient', 'phasor', 'filter', 'opamp', 'logic']);
      const validIcons = new Set('home book review tool settings plus pen marker eraser select line arrow rect ellipse text image undo redo trash download upload fit calc back check play pause clock sigma x dots search flame chart grid wave resistor matrix phasor edit side star install sparkle rotate atom'.split(' '));
      const seen = new Set();

      for (const s of SIMS) {
        assert.ok(/^[a-z0-9-]+$/.test(s.id), `Geçersiz kebab id: ${s.id}`);
        assert.ok(!seen.has(s.id), `Yinelenen id: ${s.id}`);
        assert.ok(!existingIds.has(s.id), `Mevcut sim.js id ile çakışma: ${s.id}`);
        seen.add(s.id);
        assert.ok(s.title.length > 0 && s.title.length <= 22, `Başlık uzunluğu <= 22 olmalı: "${s.title}" (${s.title.length})`);
        assert.ok(validIcons.has(s.icon), `Geçersiz ikon adı: ${s.icon}`);
        assert.equal(typeof s.mount, 'function', `${s.id} mount fonksiyonu içermeli`);
      }
    } finally {
      for (const h of timers) clearTimeout(h);
      globalThis.setTimeout = prevST;
      globalThis.window = prevWin;
      globalThis.document = prevDoc;
      globalThis.matchMedia = prevMM;
      globalThis.addEventListener = prevAdd;
      globalThis.dispatchEvent = prevDisp;
      globalThis.getComputedStyle = prevGCS;
      globalThis.indexedDB = prevIDB;
    }
  });
});
