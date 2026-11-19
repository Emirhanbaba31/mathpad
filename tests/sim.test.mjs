import * as mathjs from 'mathjs';
globalThis.math = mathjs;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  solveMNA,
  stepResponse,
  autoStepWindow,
  seriesRLC,
  transfer,
  filterMetrics,
  opampOut,
  clip,
  gate,
  halfAdder,
  truthTable,
} = await import('../js/simcore.js');

const approx = (actual, expected, tol = 1e-6, msg) => {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    msg || `Expected ${actual} to be within ${tol} of ${expected}`
  );
};

describe('solveMNA — DC analiz', () => {
  it('gerilim bölücü (12 V, 1 kΩ ve 2 kΩ -> orta düğüm 8 V)', () => {
    const res = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 12 },
      { type: 'R', name: 'R1', a: '1', b: '2', value: 1000 },
      { type: 'R', name: 'R2', a: '2', b: '0', value: 2000 },
    ], { mode: 'dc' });

    assert.equal(res.ok, true);
    approx(res.nodes['0'], 0, 1e-12);
    approx(res.nodes['1'], 12, 1e-9);
    approx(res.nodes['2'], 8, 1e-9);
    approx(res.branches.R1.i, 0.004, 1e-9);
    approx(res.branches.R2.i, 0.004, 1e-9);
    approx(res.branches.V1.i, -0.004, 1e-9);
    // Power conservation: sum of branch powers = 0
    const totalP = Object.values(res.branches).reduce((s, b) => s + b.p, 0);
    approx(totalP, 0, 1e-9);
    approx(res.branches.V1.p, -0.048, 1e-9);
    approx(res.branches.R1.p, 0.016, 1e-9);
    approx(res.branches.R2.p, 0.032, 1e-9);
  });

  it('akım kaynağı ve direnç (I1: 0 -> 1, 5 mA, R1: 2 kΩ -> V1 = 10 V)', () => {
    const res = solveMNA([
      { type: 'I', name: 'I1', a: '0', b: '1', value: 0.005 },
      { type: 'R', name: 'R1', a: '1', b: '0', value: 2000 },
    ], { mode: 'dc' });

    assert.equal(res.ok, true);
    approx(res.nodes['1'], 10, 1e-9);
    approx(res.branches.R1.i, 0.005, 1e-9);
    approx(res.branches.R1.p, 0.05, 1e-9);
    approx(res.branches.I1.v, -10, 1e-9);
    approx(res.branches.I1.i, 0.005, 1e-9);
    approx(res.branches.I1.p, -0.05, 1e-9);
  });

  it('dengeli Wheatstone köprüsü -> köprü akımı sıfır', () => {
    const res = solveMNA([
      { type: 'V', name: 'V1', a: 'in', b: '0', value: 10 },
      { type: 'R', name: 'R1', a: 'in', b: 'a', value: 1000 },
      { type: 'R', name: 'R2', a: 'a', b: '0', value: 2000 },
      { type: 'R', name: 'R3', a: 'in', b: 'b', value: 3000 },
      { type: 'R', name: 'R4', a: 'b', b: '0', value: 6000 },
      { type: 'R', name: 'Rg', a: 'a', b: 'b', value: 500 },
    ], { mode: 'dc' });

    assert.equal(res.ok, true);
    approx(res.nodes.a, 20 / 3, 1e-9);
    approx(res.nodes.b, 20 / 3, 1e-9);
    approx(res.branches.Rg.v, 0, 1e-9);
    approx(res.branches.Rg.i, 0, 1e-12);
    approx(res.branches.Rg.p, 0, 1e-12);
  });

  it('DC analizde bobin kısa devre, kondansatör açık devre davranır', () => {
    const res = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 10 },
      { type: 'L', name: 'L1', a: '1', b: '2', value: 0.01 },
      { type: 'R', name: 'R1', a: '2', b: '0', value: 100 },
      { type: 'C', name: 'C1', a: '2', b: '0', value: 1e-6 },
    ], { mode: 'dc' });

    assert.equal(res.ok, true);
    approx(res.nodes['1'], 10, 1e-9);
    approx(res.nodes['2'], 10, 1e-9);
    approx(res.branches.L1.v, 0, 1e-9);
    approx(res.branches.L1.i, 0.1, 1e-9);
    approx(res.branches.C1.v, 10, 1e-9);
    approx(res.branches.C1.i, 0, 1e-12);
  });

  it('toprak eksikliği -> ok false ve anlamlı hata', () => {
    const res = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '2', value: 5 },
      { type: 'R', name: 'R1', a: '1', b: '2', value: 100 },
    ], { mode: 'dc' });

    assert.equal(res.ok, false);
    assert.ok(typeof res.error === 'string' && res.error.length > 0);
  });

  it('yüzen düğüm (toprağa bağlı olmayan ada veya DC kondansatör izolasyonu) -> ok false', () => {
    const res1 = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 5 },
      { type: 'R', name: 'R1', a: '1', b: '0', value: 100 },
      { type: 'R', name: 'R2', a: '2', b: '3', value: 100 },
    ], { mode: 'dc' });
    assert.equal(res1.ok, false);
    assert.ok(res1.error.includes('2') || res1.error.includes('3'));

    const res2 = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 5 },
      { type: 'C', name: 'C1', a: '1', b: '2', value: 1e-6 },
      { type: 'C', name: 'C2', a: '2', b: '0', value: 1e-6 },
    ], { mode: 'dc' });
    assert.equal(res2.ok, false);
    assert.ok(res2.error.includes('2'));
  });

  it('tekil devre (paralel gerilim kaynakları) ve geçersiz değerler -> ok false', () => {
    const loop = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 5 },
      { type: 'V', name: 'V2', a: '1', b: '0', value: 10 },
      { type: 'R', name: 'R1', a: '1', b: '0', value: 100 },
    ], { mode: 'dc' });
    assert.equal(loop.ok, false);
    assert.ok(loop.error.length > 0);

    const badR = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 5 },
      { type: 'R', name: 'R1', a: '1', b: '0', value: 0 },
    ], { mode: 'dc' });
    assert.equal(badR.ok, false);
  });

  it('iki kaynaklı DC devre (gerilim + akım kaynağı) ve güç dengesi', () => {
    const res = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 12 },
      { type: 'R', name: 'R1', a: '1', b: '2', value: 1000 },
      { type: 'R', name: 'R2', a: '2', b: '0', value: 2000 },
      { type: 'R', name: 'R3', a: '2', b: '3', value: 1000 },
      { type: 'I', name: 'I1', a: '0', b: '3', value: 0.005 },
    ], { mode: 'dc' });

    assert.equal(res.ok, true);
    approx(res.nodes['1'], 12, 1e-9);
    approx(res.nodes['2'], 34 / 3, 1e-9);
    approx(res.nodes['3'], 49 / 3, 1e-9);
    const totalP = Object.values(res.branches).reduce((s, b) => s + b.p, 0);
    approx(totalP, 0, 1e-9);
  });
});

describe('solveMNA — AC analiz', () => {
  it('AC RC alçak geçiren kesim frekansında fc -> |H| ≈ 0.7071 ve faz ≈ -45°', () => {
    const R = 1000, C = 100e-9;
    const fc = 1 / (2 * Math.PI * R * C);
    const res = solveMNA([
      { type: 'V', name: 'V1', a: 'in', b: '0', value: 1, phase: 0 },
      { type: 'R', name: 'R1', a: 'in', b: 'out', value: R },
      { type: 'C', name: 'C1', a: 'out', b: '0', value: C },
    ], { mode: 'ac', f: fc });

    assert.equal(res.ok, true);
    const vout = res.nodes.out;
    assert.equal(vout.isComplex, true);
    approx(vout.abs(), Math.SQRT1_2, 1e-5);
    approx((vout.arg() * 180) / Math.PI, -45, 1e-4);
    // Complex power conservation: sum of S = 0
    const sumS = Object.values(res.branches).reduce(
      (acc, b) => mathjs.add(acc, b.p),
      mathjs.complex(0, 0)
    );
    approx(sumS.re, 0, 1e-9);
    approx(sumS.im, 0, 1e-9);
  });

  it('seri RLC rezonansta -> akım = V/R ve gerilimle aynı fazda', () => {
    const R = 50, L = 10e-3, C = 100e-9, V = 10;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const res = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: V, phase: 0 },
      { type: 'R', name: 'R1', a: '1', b: '2', value: R },
      { type: 'L', name: 'L1', a: '2', b: '3', value: L },
      { type: 'C', name: 'C1', a: '3', b: '0', value: C },
    ], { mode: 'ac', f: f0 });

    assert.equal(res.ok, true);
    const iR = res.branches.R1.i;
    assert.equal(iR.isComplex, true);
    approx(iR.abs(), V / R, 1e-6);
    approx((iR.arg() * 180) / Math.PI, 0, 1e-4);
    // Reactive powers of L and C cancel
    approx(res.branches.L1.p.im + res.branches.C1.p.im, 0, 1e-6);
    approx(res.branches.R1.p.re, (V * V) / R, 1e-6);
  });

  it('fazlı AC kaynak ve kayıpsız paralel LC rezonans tekilliği', () => {
    const res = solveMNA([
      { type: 'V', name: 'V1', a: '1', b: '0', value: 10, phase: 30 },
      { type: 'R', name: 'R1', a: '1', b: '0', value: 10 },
    ], { mode: 'ac', f: 50 });
    assert.equal(res.ok, true);
    approx(res.branches.R1.i.abs(), 1, 1e-9);
    approx((res.branches.R1.i.arg() * 180) / Math.PI, 30, 1e-6);
    approx(res.branches.R1.p.re, 10, 1e-9);
    approx(res.branches.R1.p.im, 0, 1e-9);

    const L = 10e-3, C = 100e-9;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const tank = solveMNA([
      { type: 'I', name: 'I1', a: '0', b: '1', value: 1, phase: 0 },
      { type: 'L', name: 'L1', a: '1', b: '0', value: L },
      { type: 'C', name: 'C1', a: '1', b: '0', value: C },
    ], { mode: 'ac', f: f0 });
    assert.equal(tank.ok, false);
  });
});

describe('stepResponse — Geçici Durum', () => {
  it('RC adım cevabı t = τ anında v ≈ 0.6321 V ve i ≈ 0.3679 V/R', () => {
    const R = 1000, C = 1e-6, V = 10;
    const tau = R * C;
    const res = stepResponse({ kind: 'RC', R, C, V }, 5 * tau, 501);

    approx(res.tau, tau, 1e-12);
    // Index 100 corresponds to t = 5*tau * 100 / 500 = tau
    approx(res.t[100], tau, 1e-12);
    approx(res.v[100], V * (1 - Math.exp(-1)), 1e-6);
    approx(res.i[100], (V / R) * Math.exp(-1), 1e-9);
    approx(res.v[0], 0, 1e-12);
  });

  it('RL adım cevabı t = τ anında vL = V/e ve i = (V/R)(1 - 1/e)', () => {
    const R = 100, L = 10e-3, V = 12;
    const tau = L / R;
    const res = stepResponse({ kind: 'RL', R, L, V }, 5 * tau, 501);

    approx(res.tau, tau, 1e-12);
    approx(res.v[0], V, 1e-12);
    approx(res.i[0], 0, 1e-12);
    approx(res.v[100], V * Math.exp(-1), 1e-6);
    approx(res.i[100], (V / R) * (1 - Math.exp(-1)), 1e-6);
  });

  it('RLC sönüm sınıflandırması (az / kritik / aşırı sönümlü) ve sınır koşulları', () => {
    const L = 10e-3, C = 1e-6, V = 10;
    // Critical resistance: R_crit = 2 * sqrt(L/C) = 2 * sqrt(1e4) = 200 Ω
    const under = stepResponse({ kind: 'RLC', R: 40, L, C, V }, autoStepWindow({ kind: 'RLC', R: 40, L, C }), 400);
    const crit = stepResponse({ kind: 'RLC', R: 200, L, C, V }, autoStepWindow({ kind: 'RLC', R: 200, L, C }), 400);
    const over = stepResponse({ kind: 'RLC', R: 500, L, C, V }, autoStepWindow({ kind: 'RLC', R: 500, L, C }), 400);

    assert.equal(under.type, 'az sönümlü');
    assert.ok(under.zeta < 1);
    assert.ok(Math.max(...under.v) > V, 'Az sönümlü cevapta aşım (overshoot) olmalı');

    assert.equal(crit.type, 'kritik sönümlü');
    approx(crit.zeta, 1, 1e-6);
    assert.ok(Math.max(...crit.v) <= V + 1e-9, 'Kritik sönümlü cevapta aşım olmamalı');

    assert.equal(over.type, 'aşırı sönümlü');
    assert.ok(over.zeta > 1);
    assert.ok(Math.max(...over.v) <= V + 1e-9, 'Aşırı sönümlü cevapta aşım olmamalı');

    for (const r of [under, crit, over]) {
      approx(r.v[0], 0, 1e-12);
      approx(r.i[0], 0, 1e-12);
      approx(r.v.at(-1), V, 0.2);
      approx(r.wn, 1 / Math.sqrt(L * C), 1e-6);
    }

    // Verify KVL: R*i + L*di/dt + vC = V at midpoint for all three regimes
    for (const [R, r] of [[40, under], [200, crit], [500, over]]) {
      const k = 120;
      const dt = r.t[k + 1] - r.t[k - 1];
      const didt = (r.i[k + 1] - r.i[k - 1]) / dt;
      const kvl = R * r.i[k] + L * didt + r.v[k];
      approx(kvl, V, 0.05, `KVL check failed for R=${R}`);
    }

    // High-zeta numerical stability (zeta = 50)
    const veryOver = stepResponse({ kind: 'RLC', R: 10000, L, C, V }, undefined, 300);
    assert.equal(veryOver.type, 'aşırı sönümlü');
    approx(veryOver.v.at(-1), V, 0.1);
  });
});

describe('seriesRLC — AC Fazör', () => {
  it('rezonans, endüktif ve kapasitif rejimleri doğru sınıflandırır', () => {
    const R = 100, L = 10e-3, C = 1e-6, Vm = 10;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));

    const atRes = seriesRLC({ R, L, C, f: f0, Vm });
    assert.equal(atRes.state, 'rezonansta');
    approx(atRes.Zmag, R, 1e-6);
    approx(atRes.Im, Vm / R, 1e-6);
    approx(atRes.thetaDeg, 0, 1e-4);
    approx(atRes.pf, 1, 1e-6);

    const ind = seriesRLC({ R, L, C, f: f0 * 2, Vm });
    assert.equal(ind.state, 'endüktif');
    assert.ok(ind.thetaDeg > 0);

    const cap = seriesRLC({ R, L, C, f: f0 * 0.5, Vm });
    assert.equal(cap.state, 'kapasitif');
    assert.ok(cap.thetaDeg < 0);

    // KVL: VR + VL + VC = V
    const sum = mathjs.add(mathjs.add(ind.VR, ind.VL), ind.VC);
    approx(sum.re, Vm, 1e-6);
    approx(sum.im, 0, 1e-6);
  });
});

describe('transfer & filterMetrics — Filtre & Bode', () => {
  it('RC alçak geçiren kesim frekansında |H| ≈ 0.7071 ve ∠H ≈ -45°', () => {
    const R = 1000, C = 100e-9;
    const fc = 1 / (2 * Math.PI * R * C);
    const H = transfer('rc-lp', { R, C }, fc);
    assert.equal(H.isComplex, true);
    approx(H.abs(), Math.SQRT1_2, 1e-6);
    approx((H.arg() * 180) / Math.PI, -45, 1e-5);
  });

  it('RC yüksek geçiren kesim frekansında |H| ≈ 0.7071 ve ∠H ≈ +45°', () => {
    const R = 1000, C = 100e-9;
    const fc = 1 / (2 * Math.PI * R * C);
    const H = transfer('rc-hp', { R, C }, fc);
    approx(H.abs(), Math.SQRT1_2, 1e-6);
    approx((H.arg() * 180) / Math.PI, 45, 1e-5);
  });

  it('RLC bant geçiren ve bant söndüren merkez frekansında doğru davranır', () => {
    const R = 100, L = 10e-3, C = 100e-9;
    const m = filterMetrics('rlc-bp', { R, L, C });
    const Hbp = transfer('rlc-bp', { R, L, C }, m.f0);
    const Hbs = transfer('rlc-bs', { R, L, C }, m.f0);

    approx(Hbp.abs(), 1, 1e-6);
    approx((Hbp.arg() * 180) / Math.PI, 0, 1e-5);
    approx(Hbs.abs(), 0, 1e-6);

    // At -3 dB edges f1 and f2, |Hbp| ≈ 1/sqrt(2)
    approx(transfer('rlc-bp', { R, L, C }, m.f1).abs(), Math.SQRT1_2, 1e-5);
    approx(transfer('rlc-bp', { R, L, C }, m.f2).abs(), Math.SQRT1_2, 1e-5);
    approx(m.f2 - m.f1, m.bw, 1e-6);
    approx(m.Q, m.f0 / m.bw, 1e-6);

    // DC (f = 0) edge cases and complementary sum H_bp + H_bs = 1
    approx(transfer('rc-lp', { R, C }, 0).abs(), 1, 1e-12);
    approx(transfer('rc-hp', { R, C }, 0).abs(), 0, 1e-12);
    approx(transfer('rlc-bp', { R, L, C }, 0).abs(), 0, 1e-12);
    approx(transfer('rlc-bs', { R, L, C }, 0).abs(), 1, 1e-12);
    const sum = mathjs.add(
      transfer('rlc-bp', { R, L, C }, m.f0 * 1.7),
      transfer('rlc-bs', { R, L, C }, m.f0 * 1.7)
    );
    approx(sum.re, 1, 1e-9);
    approx(sum.im, 0, 1e-9);
  });
});

describe('opampOut & clip — Op-Amp Lab', () => {
  it('eviren yükselteç kazancı -Rf/Rin ve ±Vcc kırpılması', () => {
    const ideal = opampOut('inverting', { Rin: 1000, Rf: 10000 }, 2);
    approx(ideal, -20, 1e-9);
    assert.equal(clip(ideal, 12), -12);
    assert.equal(clip(5, 12), 5);
    assert.equal(clip(18, 12), 12);
    assert.equal(clip(18, -12), 12);
  });

  it('evirmeyen, izleyici, toplayıcı ve fark yükselteci', () => {
    approx(opampOut('noninverting', { R1: 1000, Rf: 4000 }, 2), 10, 1e-9);
    approx(opampOut('follower', {}, 3.3), 3.3, 1e-9);
    approx(opampOut('summing', { R1: 1000, R2: 2000, Rf: 2000 }, 1, 3), -5, 1e-9);
    approx(opampOut('diff', { R1: 1000, Rf: 2000 }, 1, 4), 6, 1e-9);
    approx(opampOut('diff', { R1: 1000, Rf: 2000, R3: 3000, R4: 6000 }, 1, 4), 6, 1e-9);
  });
});

describe('gate, halfAdder & truthTable — Mantık Kapıları', () => {
  const expected = {
    AND:  [0, 0, 0, 1],
    OR:   [0, 1, 1, 1],
    NAND: [1, 1, 1, 0],
    NOR:  [1, 0, 0, 0],
    XOR:  [0, 1, 1, 0],
    XNOR: [1, 0, 0, 1],
  };

  for (const [name, outs] of Object.entries(expected)) {
    it(`${name} kapısı doğruluk tablosu`, () => {
      const rows = truthTable(name);
      assert.equal(rows.length, 4);
      rows.forEach((r, idx) => {
        assert.equal(r.out, outs[idx]);
        assert.equal(gate(name, r.a, r.b), outs[idx]);
      });
    });
  }

  it('NOT kapısı doğruluk tablosu', () => {
    const rows = truthTable('NOT');
    assert.deepEqual(rows, [
      { a: 0, out: 1 },
      { a: 1, out: 0 },
    ]);
    assert.equal(gate('NOT', 0), 1);
    assert.equal(gate('NOT', 1), 0);
  });

  it('yarım toplayıcı (half adder) doğruluk tablosu', () => {
    const rows = truthTable('HALF_ADDER');
    assert.deepEqual(rows, [
      { a: 0, b: 0, sum: 0, carry: 0 },
      { a: 0, b: 1, sum: 1, carry: 0 },
      { a: 1, b: 0, sum: 1, carry: 0 },
      { a: 1, b: 1, sum: 0, carry: 1 },
    ]);
    assert.deepEqual(halfAdder(1, 1), { sum: 0, carry: 1 });
  });
});
