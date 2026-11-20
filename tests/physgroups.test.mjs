import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  cAdd, cSub, cMul, cConj, cAbs2, cAbs,
  matMul, matDag, matComm, matAntiComm, matId, matApproxEq,
  innerProduct, vecNorm, normalizeState, applyOperator, isUnitary, su2Matrix, u1PhaseMatrix,
  fermiOperators, verifyFermiAnticommutators, verifyUnBilinears, fermiSpinorSplit,
  bosonTruncated, coherentState,
  su3Dim, oscillatorShell,
  BOHR_E1_EV, bohrEnergy, bohrLevel, bohrTransition, bohrSeries,
  clebschGordan, coupleIsospin, NUCLEONS, PIONS, TWO_NUCLEON_STATES,
  elliottCasimir, elliottBranching, ELLIOTT_SD_NUCLEI, SAKATA_TRIPLET, SAKATA_DECOMPOSITIONS,
  MINKOWSKI_METRIC, matMul4, apply4, minkowskiDot, lorentzBoost, lorentzRotation,
  verifyMetricPreservation, rapidityAdd, velocityAdd,
  sl2cBoost, sl2cRotation, sl2cToLorentz, sl2cDet,
  lorentzIrrep, LORENTZ_REPS_CATALOG, poincareCasimirs,
  conformalGenerators, specialConformal2D, conformalTransform2D, checkConformality2D,
  frac, fracStr, fracVal, QUARKS, checkColorSinglet, buildHadron,
  GAUGE_GROUPS, SM_FAMILY, checkElectricCharges, computeAnomalies, electroweakBreaking,
  SU5_FIVE_BAR, SU5_TEN, SU5_GAUGE_24, computeSu5WeinbergAngle, SO10_SPINOR_16, E6_FUND_27,
  TRIBIMAXIMAL_MATRIX, pmnsMatrix, verifyUnitary3, verifyTbmSymmetry, neutrinoOscillationProbs,
  HURWITZ_ALGEBRAS, cdConj, cdNorm2, cdNorm, cdMul, cdInv, cdCommutator, cdAssociator,
  FANO_TRIPLES, octonionMulTable, hermitian3Dim, jordan3Create, jordan3Product,
  jordan3IsHermitian, jordan3MaxDiff, freudenthalDet,
  MAGIC_SQUARE, MAGIC_SQUARE_LABELS, magicSquareDim,
  WALLPAPER_GROUPS, PLATONIC_SOLIDS, EVERYDAY_SHAPES,
  PHYS_QUIZ_TOPICS, generatePhysQuizQuestion,
} from '../js/physgroups.js';

function makeRng(seed = 123456) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Ch. 4: Sonlu/Sonsuz Hilbert uzayları, Fermi ve Bozon osilatörleri', () => {
  it('iç çarpım, norm ve üniter SU(2) / U(1) temsilleri doğru çalışır', () => {
    const psi = normalizeState([[1, 1], [0, 2]]);
    const phi = normalizeState([[2, -1], [1, 0]]);
    assert.ok(Math.abs(vecNorm(psi) - 1) < 1e-12);
    const U = su2Matrix(1.23, [1, -2, 3]);
    assert.equal(isUnitary(U).ok, true);
    const P = u1PhaseMatrix(0.7, 2);
    assert.equal(isUnitary(P).ok, true);
    // Unitary operators preserve inner product <U psi | U phi> = <psi | phi>
    const ipBefore = innerProduct(psi, phi);
    const ipAfter = innerProduct(applyOperator(U, psi), applyOperator(U, phi));
    assert.ok(Math.hypot(ipBefore[0] - ipAfter[0], ipBefore[1] - ipAfter[1]) < 1e-12);
  });

  it('Fermi osilatörü Jordan–Wigner antikomütatörleri n = 1, 2, 3, 4 için tam sıfır/birim sağlar', () => {
    for (const n of [1, 2, 3, 4]) {
      const res = verifyFermiAnticommutators(n);
      assert.equal(res.ok, true, `n=${n} antikomütatör hatası: ${res.maxError}`);
      assert.equal(res.dim, 1 << n);
    }
    // Explicit check for n = 3: 8x8 matrices, number operator eigenvalues 0..3
    const f3 = fermiOperators(3);
    assert.equal(f3.dim, 8);
    assert.equal(f3.basis.length, 8);
    for (let idx = 0; idx < 8; idx++) {
      assert.equal(f3.NTotal[idx][idx][0], f3.basis[idx].particleCount);
    }
  });

  it('Fermi ikili operatörleri E_ij = a_i^† a_j u(n) Lie cebirini ve SO(2n) spinör yapısını üretir', () => {
    for (const n of [2, 3]) {
      const un = verifyUnBilinears(n);
      assert.equal(un.ok, true, `u(${n}) komütatör hatası: ${un.maxError}`);
      assert.equal(un.dimGenerators, n * n);

      const sp = fermiSpinorSplit(n);
      assert.equal(sp.cliffordOk, true);
      assert.equal(sp.chiralSplitOk, true);
      assert.equal(sp.spinorDim, 1 << n);
      assert.deepEqual(sp.chiralDims, [1 << (n - 1), 1 << (n - 1)]);
      assert.equal(sp.algebraDim, n * (2 * n - 1));
    }
  });

  it('sonlu kesilmiş bozon matrisinde iz sıfır çıkar ve uyumlu durum Poisson dağılımına uyar', () => {
    const b = bosonTruncated(10);
    assert.ok(b.maxBulkError < 1e-12);
    assert.ok(Math.abs(b.defectEntry - (-9)) < 1e-12);
    assert.ok(Math.abs(b.traceComm[0]) < 1e-12);

    const coh = coherentState(1.5, -0.5, 28);
    assert.ok(Math.abs(coh.norm2 - 1) < 1e-8);
    assert.ok(Math.abs(coh.meanN - 2.5) < 1e-12);
    assert.ok(coh.eigenError < 1e-5, `Uyumlu durum özdeğer hatası: ${coh.eigenError}`);
  });
});

describe('Ch. 5.5 & 6.7: 3B Harmonik osilatör, Bohr atomu, İzospin, Elliott ve Sakata', () => {
  it('3B izotropik harmonik osilatör dejenereliği (N+1)(N+2)/2 ve SO(3) l toplamları N = 0..6 için eşleşir', () => {
    const expectedDeg = [1, 3, 6, 10, 15, 21, 28];
    const expectedL = [
      [0],
      [1],
      [2, 0],
      [3, 1],
      [4, 2, 0],
      [5, 3, 1],
      [6, 4, 2, 0],
    ];
    for (let N = 0; N <= 6; N++) {
      const sh = oscillatorShell(N);
      assert.equal(sh.degeneracy, expectedDeg[N]);
      assert.equal(sh.su3Dim, expectedDeg[N]);
      assert.equal(sh.states.length, expectedDeg[N]);
      assert.deepEqual(sh.lValues, expectedL[N]);
      assert.equal(sh.so3Sum, expectedDeg[N]);
      assert.equal(sh.matchesDegeneracy, true);
      assert.equal(sh.energyCoeff, N + 1.5);
      // SU(3) tracelessness: sum of T3 and sum of Y over every (N,0) multiplet vanish
      const sumT3 = sh.states.reduce((s, st) => s + st.t3, 0);
      const sumY = sh.states.reduce((s, st) => s + st.y, 0);
      assert.ok(Math.abs(sumT3) < 1e-12);
      assert.ok(Math.abs(sumY) < 1e-12);
    }
  });

  it('Bohr atomu SO(4) dejenereliği n^2, enerjisi -13.6 eV/n^2 ve Lyman/Balmer/Paschen çizgileri doğrudur', () => {
    for (let n = 1; n <= 8; n++) {
      const lvl = bohrLevel(n);
      assert.equal(lvl.degeneracy, n * n);
      assert.equal(lvl.so3Sum, n * n);
      assert.equal(lvl.matchesDegeneracy, true);
      assert.ok(Math.abs(lvl.energyEv - (-BOHR_E1_EV / (n * n))) < 1e-12);
      assert.ok(Math.abs(bohrEnergy(1) - (-13.605693)) < 1e-5);
    }
    const lya = bohrTransition(2, 1);
    assert.equal(lya.seriesName, 'Lyman');
    assert.ok(Math.abs(lya.wavelengthNm - 121.5) < 0.3);

    const ha = bohrTransition(3, 2);
    assert.equal(ha.seriesName, 'Balmer');
    assert.ok(Math.abs(ha.wavelengthNm - 656.1) < 0.5);

    const pa = bohrTransition(4, 3);
    assert.equal(pa.seriesName, 'Paschen');
    assert.ok(Math.abs(pa.wavelengthNm - 1874.6) < 1.0);
    assert.equal(bohrSeries(2, 6).length, 4);
  });

  it('İzospin Clebsch–Gordan katsayıları, döteron (I=0), Elliott SU(3)→SO(3) ve Sakata tutarlıdır', () => {
    // 1/2 x 1/2 = 1 (+) + 0 (-)
    const nn = coupleIsospin(0.5, 0.5);
    assert.equal(nn.productDim, 4);
    assert.deepEqual(nn.irreps.map(x => x.J), [1, 0]);
    assert.ok(Math.abs(clebschGordan(0.5, 0.5, 0.5, -0.5, 0, 0) - Math.SQRT1_2) < 1e-12);
    assert.ok(Math.abs(clebschGordan(0.5, -0.5, 0.5, 0.5, 0, 0) - (-Math.SQRT1_2)) < 1e-12);
    assert.ok(Math.abs(clebschGordan(0.5, 0.5, 0.5, -0.5, 1, 0) - Math.SQRT1_2) < 1e-12);
    assert.equal(TWO_NUCLEON_STATES[0].I, 0);
    assert.equal(TWO_NUCLEON_STATES[0].bound, true);
    assert.equal(NUCLEONS.length, 2);
    assert.equal(PIONS.length, 3);

    // Elliott SU(3) -> SO(3) branching exact dimension checks across many (lambda, mu)
    const pairs = [[2, 0], [4, 0], [8, 0], [2, 1], [1, 1], [2, 2], [8, 4], [0, 12], [6, 3]];
    for (const [lam, mu] of pairs) {
      const eb = elliottBranching(lam, mu);
      assert.equal(eb.matchesDim, true, `Elliott (${lam},${mu}) toplam ${eb.totalStates} != ${eb.dim}`);
      assert.equal(eb.dim, su3Dim(lam, mu));
    }
    assert.equal(elliottCasimir(8, 0), 88);
    assert.equal(ELLIOTT_SD_NUCLEI.length, 6);
    assert.equal(SAKATA_TRIPLET.length, 3);
    assert.equal(SAKATA_DECOMPOSITIONS.baryons.dims.reduce((a, b) => a + b, 0), 27);
  });
});

describe('Ch. 11.1: Lorentz SO(3,1), SL(2,C), Poincaré ve Konformal Grup SO(4,2)', () => {
  it('Lorentz boost bileşkesinde rapiditeler toplanır ve metrik Λ^T η Λ = η korunur', () => {
    const eta1 = 0.73, eta2 = -0.41;
    const B1 = lorentzBoost(eta1, [1, 0, 0]);
    const B2 = lorentzBoost(eta2, [1, 0, 0]);
    const B12 = matMul4(B1, B2);
    const Bsum = lorentzBoost(rapidityAdd(eta1, eta2), [1, 0, 0]);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        assert.ok(Math.abs(B12[i][j] - Bsum[i][j]) < 1e-12);
      }
    }
    // Velocity addition consistency
    const b1 = Math.tanh(eta1), b2 = Math.tanh(eta2);
    assert.ok(Math.abs(velocityAdd(b1, b2) - Math.tanh(eta1 + eta2)) < 1e-12);

    // Arbitrary boost + rotation product preserves Minkowski metric
    const R = lorentzRotation(1.1, [1, 2, -1]);
    const B3 = lorentzBoost(0.85, [0.2, -0.7, 0.5]);
    const L = matMul4(R, B3);
    assert.equal(verifyMetricPreservation(B1).ok, true);
    assert.equal(verifyMetricPreservation(R).ok, true);
    assert.equal(verifyMetricPreservation(L).ok, true);

    const v = [3.5, 1.2, -0.8, 2.1];
    const lv = apply4(L, v);
    assert.ok(Math.abs(minkowskiDot(lv, lv) - minkowskiDot(v, v)) < 1e-11);
  });

  it('SL(2,C) çift örtüsü SO^+(3,1) ile birebir uyuşur ve 2π dönmede -I verir', () => {
    const M = sl2cBoost(0.9, [0.3, -0.4, 0.85]);
    const det = sl2cDet(M);
    assert.ok(Math.hypot(det[0] - 1, det[1]) < 1e-12);
    const LfromM = sl2cToLorentz(M);
    const Ldirect = lorentzBoost(0.9, [0.3, -0.4, 0.85]);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        assert.ok(Math.abs(LfromM[i][j] - Ldirect[i][j]) < 1e-11);
      }
    }
    // 2*pi rotation in SL(2,C) is -I_2, yet maps to I_4 in SO(3,1)
    const R2pi = sl2cRotation(2 * Math.PI, [0, 0, 1]);
    assert.ok(Math.abs(R2pi[0][0][0] - (-1)) < 1e-12);
    const L2pi = sl2cToLorentz(R2pi);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(L2pi[i][i] - 1) < 1e-12);

    // Arbitrary 3D rotation in SL(2,C) matches SO(3,1) lorentzRotation
    const RarbSl = sl2cRotation(1.17, [1, -2, 3]);
    const RarbFromSl = sl2cToLorentz(RarbSl);
    const RarbDirect = lorentzRotation(1.17, [1, -2, 3]);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        assert.ok(Math.abs(RarbFromSl[i][j] - RarbDirect[i][j]) < 1e-11);
      }
    }
  });

  it('Lorentz (j1,j2) temsil boyutları, Poincaré Casimirleri ve Konformal SO(4,2) 15 üreteç doğrudur', () => {
    assert.equal(lorentzIrrep(0, 0).dim, 1);
    assert.equal(lorentzIrrep(0.5, 0).dim, 2);
    assert.equal(lorentzIrrep(0, 0.5).dim, 2);
    assert.equal(lorentzIrrep(0.5, 0.5).dim, 4);
    assert.equal(lorentzIrrep(1, 0).dim, 3);
    assert.equal(lorentzIrrep(1, 0.5).dim, 6);
    assert.equal(lorentzIrrep(1, 1).dim, 9);
    assert.equal(LORENTZ_REPS_CATALOG.length, 7);

    // Massive spin-1/2 particle: P^2 = m^2, W^2 = -m^2 * (3/4)
    const massive = poincareCasimirs([5, 3, 0, 0], 0.5);
    assert.ok(Math.abs(massive.p2 - 16) < 1e-12);
    assert.ok(Math.abs(massive.mass - 4) < 1e-12);
    assert.ok(Math.abs(massive.w2 - (-16 * 0.75)) < 1e-12);
    assert.equal(massive.dof, 2);

    // Massless photon: P^2 = 0, W^2 = 0, ISO(2)
    const massless = poincareCasimirs([5, 0, 0, 5], 1);
    assert.equal(massless.p2, 0);
    assert.equal(massless.w2, 0);
    assert.ok(massless.littleGroup.includes('ISO(2)'));

    // Conformal SO(4,2) has 15 generators and SCT preserves 90-degree grid angles
    const cg = conformalGenerators(4);
    assert.equal(cg.total, 15);
    assert.equal(cg.formulaCheck, true);
    const conf = checkConformality2D(0.4, -0.3, { lambda: 1.25, theta: 0.4, bx: 0.35, by: -0.2 });
    assert.equal(conf.ok, true);
    assert.ok(Math.abs(conf.angleDeg - 90) < 1e-3);
    const sct0 = specialConformal2D(0, 0, 0.3, 0.4);
    assert.equal(sct0.x, 0);
    assert.equal(sct0.y, 0);
  });
});

describe('Ch. 11.2–11.7: Kuarklar, Standart Model, Anomaliler, Büyük Birleşme ve Aile Simetrileri', () => {
  it('Kuark kuantum sayıları ve renk teklisi (qqq ve q q̄) kontrolleri doğrudur', () => {
    assert.equal(QUARKS.length, 6);
    assert.equal(checkColorSinglet('baryon', ['r', 'g', 'b']).singlet, true);
    assert.equal(checkColorSinglet('baryon', ['r', 'r', 'b']).singlet, false);
    assert.equal(checkColorSinglet('meson', ['g', 'g']).singlet, true);
    assert.equal(checkColorSinglet('meson', ['r', 'b']).singlet, false);

    const proton = buildHadron('baryon', ['u', 'u', 'd']);
    assert.equal(fracStr(proton.Q), '1');
    assert.equal(proton.gmnOk, true);
    const omega = buildHadron('baryon', ['s', 's', 's']);
    assert.equal(fracStr(omega.Q), '-1');
    assert.equal(omega.S, -3);
    const piPlus = buildHadron('meson', ['u', 'd']);
    assert.equal(fracStr(piPlus.Q), '1');
  });

  it('Standart Modelde her alan için Q = T3 + Y sağlanır ve beş anomali toplamının tamamı sıfırlanır', () => {
    assert.deepEqual(GAUGE_GROUPS.map(g => g.dim), [1, 3, 8]);

    const qCheck = checkElectricCharges(SM_FAMILY);
    assert.equal(qCheck.allMatch, true);
    assert.equal(qCheck.rows.length, 8); // u_L, d_L, u_R, d_R, nu_L, e_L, e_R, nu_R

    // Without nu_R and with nu_R: all 5 anomalies must vanish exactly!
    for (const includeNuR of [false, true]) {
      const anom = computeAnomalies(SM_FAMILY, { includeNuR });
      assert.equal(anom.sumY[0], 0, 'sum Y != 0');
      assert.equal(anom.sumY3[0], 0, 'sum Y^3 != 0');
      assert.equal(anom.su3sqU1[0], 0, 'SU(3)^2 U(1) != 0');
      assert.equal(anom.su2sqU1[0], 0, 'SU(2)^2 U(1) != 0');
      assert.equal(anom.gravitational[0], 0, 'Gravitational != 0');
      assert.equal(anom.su3Cube[0], 0, 'SU(3)^3 != 0');
      assert.equal(anom.wittenOk, true);
      assert.equal(anom.allZero, true);
    }

    // Perturbing one hypercharge must break anomaly cancellation
    const broken = SM_FAMILY.map(f => f.id === 'eR' ? { ...f, Y: frac(-2, 1) } : f);
    assert.equal(computeAnomalies(broken).allZero, false);

    // Electroweak symmetry breaking check
    const ew = electroweakBreaking(0.23122, 246.22, 0.6529);
    assert.ok(Math.abs(ew.rho - 1) < 1e-12);
    assert.ok(Math.abs(ew.mwGeV - 80.38) < 0.1);
    assert.ok(Math.abs(ew.mzGeV - 91.68) < 0.6);
  });

  it('SU(5) GUT iz hesabından sin²θ_W = 3/8 çıkar, 24 bozon, SO(10) 16 ve E6 27 toplamları tutar', () => {
    const gut = computeSu5WeinbergAngle();
    assert.deepEqual(gut.sin2Frac, [3, 8]);
    assert.equal(gut.sin2Val, 0.375);
    assert.deepEqual(gut.fiveBar.sin2Frac, [3, 8]);
    assert.deepEqual(gut.ten.sin2Frac, [3, 8]);
    assert.equal(gut.fiveBar.trQ[0], 0);
    assert.equal(gut.fiveBar.trY[0], 0);

    assert.equal(SU5_FIVE_BAR.length, 5);
    assert.equal(SU5_TEN.length, 10);
    assert.equal(SU5_GAUGE_24.reduce((s, b) => s + b.dim, 0), 24);
    assert.equal(SO10_SPINOR_16.su5Branching.reduce((s, b) => s + b.dim, 0), 16);
    assert.equal(SO10_SPINOR_16.patiSalamBranching.reduce((s, b) => s + b.dim, 0), 16);
    assert.equal(E6_FUND_27.so10Branching.reduce((s, b) => s + b.dim, 0), 27);
  });

  it('Tribimaximal PMNS matrisi üniterdir, V_4 simetrisine sahiptir ve salınım olasılıkları 1 toplanır', () => {
    const tbm = verifyTbmSymmetry();
    assert.equal(tbm.unitary, true);
    assert.equal(tbm.muTauInvariant, true);
    assert.equal(tbm.s2Invariant, true);
    assert.equal(tbm.commuteV4, true);
    assert.ok(Math.abs(tbm.sin2_12 - 1 / 3) < 1e-12);
    assert.ok(Math.abs(tbm.sin2_23 - 0.5) < 1e-12);
    assert.ok(Math.abs(tbm.sin2_13) < 1e-12);

    const Uexp = pmnsMatrix(33.41, 49.0, 8.54, 197);
    assert.equal(verifyUnitary3(Uexp).ok, true);
    const probs = neutrinoOscillationProbs(1, 500);
    assert.ok(Math.abs(probs[0] + probs[1] + probs[2] - 1) < 1e-12);
  });
});

describe('Ch. 1 & 12: Hurwitz cebirleri, Oktoniyonlar, Albert cebiri, Sihirli Kare, 17 Duvar Kağıdı ve Platon Katıları', () => {
  it('Kuaterniyon i*j = k, değişmesizlik ve birleşme özellikleri tam sağlanır', () => {
    const one = [1, 0, 0, 0];
    const qi = [0, 1, 0, 0];
    const qj = [0, 0, 1, 0];
    const qk = [0, 0, 0, 1];
    assert.deepEqual(cdMul(qi, qj), qk);
    assert.deepEqual(cdMul(qj, qk), qi);
    assert.deepEqual(cdMul(qk, qi), qj);
    assert.deepEqual(cdMul(qj, qi), [0, 0, 0, -1]);
    assert.deepEqual(cdMul(qi, qi), [-1, 0, 0, 0]);
    assert.ok(cdNorm(cdCommutator(qi, qj)) > 1.9);

    const rng = makeRng(77);
    const randH = () => Array.from({ length: 4 }, () => rng() * 4 - 2);
    for (let t = 0; t < 15; t++) {
      const a = randH(), b = randH(), c = randH();
      // Associative in H
      assert.ok(cdNorm(cdAssociator(a, b, c)) < 1e-12);
      // Norm multiplicative
      assert.ok(Math.abs(cdNorm2(cdMul(a, b)) - cdNorm2(a) * cdNorm2(b)) < 1e-10);
      // Multiplicative inverse
      const prod = cdMul(a, cdInv(a));
      assert.ok(cdNorm(prod.map((v, i) => v - one[i])) < 1e-12);
    }
  });

  it('Oktoniyonlar rastgele elemanlarda norm çarpımsallığı, birleşmesizlik, alternatifsellik ve Fano düzlemini sağlar', () => {
    const rng = makeRng(2026);
    const randO = () => Array.from({ length: 8 }, () => rng() * 4 - 2);
    let foundNonAssoc = false;

    for (let t = 0; t < 25; t++) {
      const x = randO(), y = randO(), z = randO();
      // Norm multiplicativity: ||xy||^2 = ||x||^2 ||y||^2
      const lhs = cdNorm2(cdMul(x, y));
      const rhs = cdNorm2(x) * cdNorm2(y);
      assert.ok(Math.abs(lhs - rhs) / Math.max(1, rhs) < 1e-11);

      // Alternativity: [x, x, y] = 0 and [y, x, x] = 0
      assert.ok(cdNorm(cdAssociator(x, x, y)) < 1e-11);
      assert.ok(cdNorm(cdAssociator(y, x, x)) < 1e-11);

      // Non-associativity
      if (cdNorm(cdAssociator(x, y, z)) > 1e-3) foundNonAssoc = true;
    }
    assert.equal(foundNonAssoc, true, 'Oktoniyonlarda birleşmesiz üçlü bulunmalı');

    // Fano triples match Cayley-Dickson table exactly
    const tbl = octonionMulTable();
    assert.equal(FANO_TRIPLES.length, 7);
    for (const [a, b, c] of FANO_TRIPLES) {
      assert.equal(tbl[a][b].sign, 1);
      assert.equal(tbl[a][b].index, c);
      assert.equal(tbl[b][c].sign, 1);
      assert.equal(tbl[b][c].index, a);
      assert.equal(tbl[c][a].sign, 1);
      assert.equal(tbl[c][a].index, b);
      assert.equal(tbl[b][a].sign, -1);
      assert.equal(tbl[b][a].index, c);
    }

    // Sedenions (dim 16) have zero divisors — Hurwitz theorem stops at dim 8!
    const s1 = new Array(16).fill(0); s1[3] = 1; s1[10] = 1; // e3 + e10
    const s2 = new Array(16).fill(0); s2[6] = 1; s2[15] = -1; // e6 - e15
    assert.ok(cdNorm(s1) > 0 && cdNorm(s2) > 0);
    assert.ok(cdNorm(cdMul(s1, s2)) < 1e-12, 'Sedeniyonlarda sıfır bölen var olmalı');
  });

  it('Albert cebiri J_3(O) boyutu 27, Jordan çarpımı Hermisyen ve Jordan özdeşliğini sağlar', () => {
    assert.deepEqual(HURWITZ_ALGEBRAS.map(h => hermitian3Dim(h.dim)), [6, 9, 15, 27]);

    const rng = makeRng(999);
    const randO = () => Array.from({ length: 8 }, () => rng() * 2 - 1);
    const A = jordan3Create(1.2, -0.5, 0.8, randO(), randO(), randO());
    const B = jordan3Create(-0.4, 1.1, 0.3, randO(), randO(), randO());
    assert.equal(jordan3IsHermitian(A), true);
    assert.equal(jordan3IsHermitian(B), true);

    const AoB = jordan3Product(A, B);
    assert.equal(jordan3IsHermitian(AoB), true);
    // Commutative: A o B = B o A
    assert.ok(jordan3MaxDiff(AoB, jordan3Product(B, A)) < 1e-12);

    // Jordan identity: (A o B) o A^2 = A o (B o A^2)
    const A2 = jordan3Product(A, A);
    const lhs = jordan3Product(AoB, A2);
    const rhs = jordan3Product(A, jordan3Product(B, A2));
    assert.ok(jordan3MaxDiff(lhs, rhs) < 1e-10, 'Albert cebiri Jordan özdeşliğini sağlamalı');

    // Freudenthal determinant of diagonal matrix = d1*d2*d3
    const Z = new Array(8).fill(0);
    const diagM = jordan3Create(2, 3, -5, Z, Z, Z);
    assert.equal(freudenthalDet(diagM), -30);
  });

  it('Freudenthal–Tits Sihirli Karesinin 16 boyutu, simetrisi ve çift formül eşleşmesi doğrudur', () => {
    const expected = [
      [3, 8, 21, 52],
      [8, 16, 35, 78],
      [21, 35, 66, 133],
      [52, 78, 133, 248],
    ];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = MAGIC_SQUARE[r][c];
        assert.equal(cell.dim, expected[r][c]);
        assert.equal(cell.dimFormula.formulasMatch, true);
        assert.equal(cell.dimCheck, true);
        assert.equal(cell.dim, MAGIC_SQUARE[c][r].dim);
        const direct = magicSquareDim(MAGIC_SQUARE_LABELS[r], MAGIC_SQUARE_LABELS[c]);
        assert.equal(direct.dim, expected[r][c]);
      }
    }
  });

  it('17 duvar kağıdı grubu, 5 Platon katısı ve günlük şekiller eksiksiz ve matematiksel olarak doğrudur', () => {
    assert.equal(WALLPAPER_GROUPS.length, 17);
    const iucs = new Set(WALLPAPER_GROUPS.map(w => w.iuc));
    assert.equal(iucs.size, 17);
    const expectedIuc = [
      'p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm',
      'p4', 'p4m', 'p4g', 'p3', 'p3m1', 'p31m', 'p6', 'p6m',
    ];
    for (const sym of expectedIuc) assert.ok(iucs.has(sym), `Eksik duvar kağıdı grubu: ${sym}`);
    // Verify expected orbit sizes per conventional cell
    const byIuc = Object.fromEntries(WALLPAPER_GROUPS.map(w => [w.iuc, w]));
    assert.equal(byIuc.p1.ops.length, 1);
    assert.equal(byIuc.p2.ops.length, 2);
    assert.equal(byIuc.p4.ops.length, 4);
    assert.equal(byIuc.p4m.ops.length, 8);
    assert.equal(byIuc.p4g.ops.length, 8);
    assert.equal(byIuc.p3.ops.length, 3);
    assert.equal(byIuc.p3m1.ops.length, 6);
    assert.equal(byIuc.p31m.ops.length, 6);
    assert.equal(byIuc.p6.ops.length, 6);
    assert.equal(byIuc.p6m.ops.length, 12);

    // 5 Platonic solids: Euler V - E + F = 2 and exact generated edges
    assert.equal(PLATONIC_SOLIDS.length, 5);
    for (const s of PLATONIC_SOLIDS) {
      assert.equal(s.V - s.E + s.F, 2, `${s.name} Euler hatası`);
      assert.equal(s.vertices.length, s.V);
      assert.equal(s.edges.length, s.E, `${s.name} kenar sayısı uyuşmuyor`);
    }
    assert.equal(EVERYDAY_SHAPES.length, 6);
  });

  it('Alıştırma üreteci tüm 3 bölüm ve 15 konu için geçerli, benzersiz şıklı sorular üretir', () => {
    const rng = makeRng(314159);
    for (const ch of ['fizik', 'uzayzaman', 'ozel']) {
      for (const [topicKey] of PHYS_QUIZ_TOPICS[ch]) {
        for (const diff of ['kolay', 'orta', 'zor']) {
          const q = generatePhysQuizQuestion(ch, diff, rng, topicKey);
          assert.ok(q.prompt.length > 10);
          assert.equal(q.options.length, 4, `${ch}/${topicKey} 4 şık olmalı`);
          assert.equal(new Set(q.options).size, 4, `${ch}/${topicKey} tekrar eden şık var`);
          assert.ok(q.answerIndex >= 0 && q.answerIndex < 4);
          assert.ok(q.explanation.length > 10);
        }
      }
    }
  });
});

describe('Part C Sekme Modülü (js/phys-tabs.js), Dersler, CSS ve DOM Doğrulaması', () => {
  it('TABS arayüzü, tüm 19 sekme, ikonlar, ders bağlantıları, CSS ve mount/unmount sorunsuzdur', async () => {
    const noop = () => {};
    const makeCtx2d = () => new Proxy({}, { get: () => noop });
    const makeStubEl = () => {
      const el = {
        innerHTML: '',
        textContent: '',
        style: {},
        dataset: {},
        clientWidth: 380,
        clientHeight: 280,
        isConnected: true,
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        setAttribute: noop,
        addEventListener: noop,
        removeEventListener: noop,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 380, height: 280 }),
        getContext: makeCtx2d,
        querySelector: () => null,
        querySelectorAll: () => [],
        append: noop,
        prepend: noop,
        parentElement: null,
      };
      el.parentElement = { clientWidth: 380, clientHeight: 280 };
      return el;
    };

    // Minimal browser globals for importing fx.js/ui.js/phys-tabs.js cleanly in Node
    globalThis.matchMedia ??= () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
    globalThis.addEventListener ??= noop;
    globalThis.removeEventListener ??= noop;
    globalThis.dispatchEvent ??= noop;
    globalThis.requestAnimationFrame ??= () => 1;
    globalThis.cancelAnimationFrame ??= noop;
    globalThis.getComputedStyle ??= () => ({ getPropertyValue: () => '#60a5fa' });
    globalThis.window ??= globalThis;
    globalThis.localStorage ??= {
      _map: new Map(),
      getItem(k) { return this._map.get(k) ?? null; },
      setItem(k, v) { this._map.set(k, String(v)); },
    };
    globalThis.document ??= {
      hidden: false,
      hasFocus: () => true,
      documentElement: {
        dataset: { motion: 'reduced' },
        classList: { contains: () => false, toggle: noop },
      },
      body: { dataset: {} },
      head: { append: noop },
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeStubEl(),
    };

    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (...args) => {
      const h = origSetTimeout(...args);
      h?.unref?.();
      return h;
    };
    let tabsMod, lessonsMod, uiMod;
    try {
      tabsMod = await import('../js/phys-tabs.js');
      lessonsMod = await import('../js/phys-lessons.js');
      uiMod = await import('../js/ui.js');
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }

    const { TABS } = tabsMod;
    assert.ok(Array.isArray(TABS));
    assert.equal(TABS.length, 19);

    const validChapters = new Set(['fizik', 'uzayzaman', 'ozel']);
    const ids = new Set();
    for (const tab of TABS) {
      assert.match(tab.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `Geçersiz kebab-id: ${tab.id}`);
      assert.equal(ids.has(tab.id), false, `Yinelenen sekme id: ${tab.id}`);
      ids.add(tab.id);
      assert.ok(validChapters.has(tab.chapter), `Geçersiz bölüm id: ${tab.chapter}`);
      assert.equal(tab.usesGroup, false, `usesGroup false olmalı: ${tab.id}`);
      assert.equal(typeof tab.title, 'string');
      assert.ok(tab.title.length >= 3);
      assert.equal(typeof tab.mount, 'function');
      const svg = uiMod.icon(tab.icon);
      assert.ok(svg.startsWith('<svg'), `Geçersiz sekme ikonu: ${tab.icon}`);
    }

    // Every chapter must have lessons + exercises tabs
    for (const ch of validChapters) {
      assert.ok(TABS.some(t => t.chapter === ch && t.id === `${ch}-konu`), `${ch} konu sekmesi eksik`);
      assert.ok(TABS.some(t => t.chapter === ch && t.id === `${ch}-alistirma`), `${ch} alıştırma sekmesi eksik`);
    }

    // Zero ID collision with built-in finite-group tabs
    const builtInIds = new Set(['kesif', 'cayley', 'simetri', 'permutasyon', 'graf', 'altgrup', 'eslenik', 'homomorfizma', 'teoremler', 'quiz']);
    for (const id of ids) {
      assert.equal(builtInIds.has(id), false, `Yerleşik sekme ile ID çakışması: ${id}`);
    }

    // Verify all lesson apply.tab links target real tabs in TABS
    const allLessons = [
      ...lessonsMod.FIZIK_LESSONS,
      ...lessonsMod.UZAYZAMAN_LESSONS,
      ...lessonsMod.OZEL_LESSONS,
    ];
    assert.ok(allLessons.length >= 16);
    for (const l of allLessons) {
      assert.ok(ids.has(l.apply.tab), `Ders Uygula hedefi bulunamadı: ${l.id} -> ${l.apply.tab}`);
      // Guard against accidental JS escape characters inside LaTeX strings (e.g. \b -> backspace, \f -> formfeed)
      const joined = [...l.body, l.theorem || '', l.example || ''].join(' ');
      assert.equal(/[\b\f\r\v]/.test(joined), false, `Ders ${l.id} içinde kaçış karakteri hatası`);
    }

    // Scan every icon('...') call across all js/phys-*.js files
    const physFiles = [
      '../js/phys-tabs.js',
      '../js/phys-ui.js',
      '../js/phys-tabs-fizik.js',
      '../js/phys-tabs-uzayzaman.js',
      '../js/phys-tabs-ozel.js',
    ];
    for (const fname of physFiles) {
      const src = readFileSync(new URL(fname, import.meta.url), 'utf8');
      for (const m of src.matchAll(/icon\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g)) {
        assert.ok(uiMod.icon(m[1]).startsWith('<svg'), `${fname} içinde tanımsız ikon: ${m[1]}`);
      }
      if (fname.includes('phys-tabs-')) {
        const stray = src.match(/\$[A-Za-z\\0-9][^$\n`]{1,40}\$/g);
        assert.equal(stray, null, `${fname} içinde işlenmemiş $...$ bulundu: ${stray?.join(', ')}`);
      }
    }

    // Verify css/phys.css has .phy- classes, mobile responsive rules, and motion accessibility rules
    const cssSrc = readFileSync(new URL('../css/phys.css', import.meta.url), 'utf8');
    assert.ok(cssSrc.includes('.phy-stage'));
    assert.ok(cssSrc.includes('.phy-magic-grid'));
    assert.ok(cssSrc.includes('.phy-fano-svg'));
    assert.ok(cssSrc.includes('@media (max-width: 820px)'));
    assert.ok(cssSrc.includes('data-motion="reduced"'));
    assert.ok(cssSrc.includes('data-motion="off"'));

    // Mount, exercise every sub-mode & canvas onDraw, and cleanly unmount every single tab
    const SUBMODES = {
      'hilbert-fermi': ['[data-hf-mode]', ['finite', 'boson']],
      'izospin-cekirdek': ['[data-iso-mode]', ['elliott', 'sakata']],
      'lorentz-poincare': ['[data-lp-mode]', ['reps', 'poincare']],
      'standart-model': ['[data-sm-mode]', ['gauge', 'higgs']],
      'buyuk-birlesme': ['[data-gut-mode]', ['so10', 'e6']],
      'simetri-galerisi': ['[data-sg-mode]', ['platonic', 'everyday']],
      'hurwitz-cebirleri': ['[data-hw-mode]', ['calc', 'albert']],
    };
    let canvasDrawCount = 0;
    const makeInteractiveHost = () => {
      const listeners = new Map();
      const makeCtxChecked = () => new Proxy({}, {
        get: (_t, prop) => (...args) => {
          for (const a of args) {
            if (typeof a === 'number') assert.equal(Number.isNaN(a), false, `Canvas.${String(prop)} NaN arg`);
          }
          if (prop === 'clearRect') canvasDrawCount++;
        },
      });
      const makeChild = sel => {
        const ch = {
          innerHTML: '',
          textContent: '',
          style: {},
          dataset: {},
          clientWidth: 380,
          clientHeight: 280,
          width: 380,
          height: 280,
          parentElement: { clientWidth: 380, clientHeight: 280 },
          classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
          setAttribute: noop,
          addEventListener: (ev, fn) => listeners.set(`${sel}:${ev}`, fn),
          removeEventListener: noop,
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 380, height: 280 }),
          getContext: makeCtxChecked,
        };
        return ch;
      };
      const host = {
        innerHTML: '',
        isConnected: true,
        querySelector: sel => (sel.includes('-cv]') || sel.includes('-mode]')) ? makeChild(sel) : null,
        querySelectorAll: () => [],
        _fireMode(sel, modeVal) {
          const fn = listeners.get(`${sel}:click`);
          if (fn) fn({ target: { closest: () => ({ dataset: { m: modeVal } }) } });
        },
      };
      return host;
    };

    for (const tab of TABS) {
      const host = makeInteractiveHost();
      const cleanFns = [];
      const ctx = {
        clean: { add(fn) { if (typeof fn === 'function') cleanFns.push(fn); } },
        setGroup: noop,
        jumpTo: noop,
      };
      const ret = tab.mount(host, null, ctx);
      assert.ok(host.innerHTML.length > 80, `${tab.id} içerik üretmedi`);
      if (SUBMODES[tab.id]) {
        const [sel, modes] = SUBMODES[tab.id];
        for (const m of modes) {
          host._fireMode(sel, m);
          assert.ok(host.innerHTML.length > 80, `${tab.id} alt-modu (${m}) içerik üretmedi`);
        }
      }
      if (typeof ret === 'function') ret();
      for (const fn of cleanFns) fn();
    }
    assert.ok(canvasDrawCount >= 12, `En az 12 tuval çizimi bekleniyor, gerçekleşen: ${canvasDrawCount}`);
  });
});
