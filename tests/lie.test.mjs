import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CASIMIR_NORMALIZATION,
  rat,
  ratAdd,
  ratSub,
  ratMul,
  ratDiv,
  ratEq,
  ratFormat,
  factorialBig,
  invertRatMatrix,
  detRatMatrix,
  c,
  matEye,
  matZero,
  matAdd,
  matSub,
  matMul,
  matScale,
  matComm,
  matAntiComm,
  matDag,
  matExp,
  matMaxAbs,
  getAlgebra,
  parseAlgebra,
  listAlgebras,
  weightInnerProduct,
  rootInnerProduct,
  rootCoordsToDynkin,
  dynkinToRootCoords,
  reflectWeight,
  toDominantWeight,
  rootString,
  weylDimension,
  weylDimensionSteps,
  casimirC2,
  dynkinIndex,
  conjugateWeight,
  congruenceClass,
  repReality,
  weightSystem,
  fundamentalReps,
  applyWeylWord,
  weylOrbit,
  weylGroupElements,
  tensorProduct,
  symmetricAntisymmetricSquare,
  dynkinToPartition,
  partitionToDynkin,
  youngConjugate,
  youngHooksAndContents,
  pauliMatrices,
  spinorInfo,
  cliffordGammas,
  fermionicOscillatorSpinor,
  verifyClifford,
  extendedDynkin,
  borelDeSiebenthal,
  BRANCHING_CHAINS,
  branchingRule,
  su2SpinMatrices,
  su2RotationMatrix,
  so3RotationMatrix,
  wignerSmallD,
  clebschGordan,
  su2TensorDecomp,
  su11DefiningMatrices,
  su11GroupElement,
  su11DiscreteSeries,
  oscillatorSU2,
  bohrAtomSO4,
  oscillatorSU11,
  gellMannMatrices,
  su3StructureConstants,
  su3Bases,
  su3Dim,
  su3WeightToI3Y,
  su3OscillatorShell,
  elliottBranching,
  EIGHTFOLD_WAY_MULTIPLETS,
  gellMannOkuboCheck,
  sl2VermaModule,
  kostantPartitionRank2,
  vermaRank2,
  weylCharacterFormula,
  serreRelations,
  affineAlgebra,
  sugawaraCentralCharge,
  integrableAffineWeights,
  SUPER_ALGEBRAS,
  superDynkinDiagram,
  LIE_QUIZ_TOPICS,
  generateLieQuizQuestion,
} from '../js/lie.js';

describe('Basit Lie cebirlerinin sınıflandırılması: boyut, pozitif kökler, Coxeter ve Weyl mertebeleri', () => {
  it('A_n (n=1..8): dim = n(n+2), |Δ+| = n(n+1)/2, |W| = (n+1)!, h = n+1', () => {
    for (let n = 1; n <= 8; n++) {
      const alg = getAlgebra('A', n);
      assert.equal(alg.rank, n);
      assert.equal(alg.dimension, n * (n + 2));
      assert.equal(alg.numPositiveRoots, (n * (n + 1)) / 2);
      assert.equal(alg.weylOrder, factorialBig(n + 1));
      assert.equal(alg.coxeterNumber, n + 1);
      assert.equal(alg.dualCoxeterNumber, n + 1);
      assert.equal(alg.cartanDet, n + 1);
    }
  });

  it('B_n (n=2..8): dim = n(2n+1), |Δ+| = n^2, |W| = 2^n n!, h = 2n, h^v = 2n-1', () => {
    for (let n = 2; n <= 8; n++) {
      const alg = getAlgebra('B', n);
      assert.equal(alg.rank, n);
      assert.equal(alg.dimension, n * (2 * n + 1));
      assert.equal(alg.numPositiveRoots, n * n);
      assert.equal(alg.weylOrder, (1n << BigInt(n)) * factorialBig(n));
      assert.equal(alg.coxeterNumber, 2 * n);
      assert.equal(alg.dualCoxeterNumber, 2 * n - 1);
      assert.equal(alg.cartanDet, 2);
    }
  });

  it('C_n (n=2..8): dim = n(2n+1), |Δ+| = n^2, |W| = 2^n n!, h = 2n, h^v = n+1', () => {
    for (let n = 2; n <= 8; n++) {
      const alg = getAlgebra('C', n);
      assert.equal(alg.rank, n);
      assert.equal(alg.dimension, n * (2 * n + 1));
      assert.equal(alg.numPositiveRoots, n * n);
      assert.equal(alg.weylOrder, (1n << BigInt(n)) * factorialBig(n));
      assert.equal(alg.coxeterNumber, 2 * n);
      assert.equal(alg.dualCoxeterNumber, n + 1);
      assert.equal(alg.cartanDet, 2);
    }
  });

  it('D_n (n=3..8): dim = n(2n-1), |Δ+| = n(n-1), |W| = 2^(n-1) n!, h = h^v = 2n-2', () => {
    for (let n = 3; n <= 8; n++) {
      const alg = getAlgebra('D', n);
      assert.equal(alg.rank, n);
      assert.equal(alg.dimension, n * (2 * n - 1));
      assert.equal(alg.numPositiveRoots, n * (n - 1));
      assert.equal(alg.weylOrder, (1n << BigInt(n - 1)) * factorialBig(n));
      assert.equal(alg.coxeterNumber, 2 * n - 2);
      assert.equal(alg.dualCoxeterNumber, 2 * n - 2);
      assert.equal(alg.cartanDet, 4);
    }
  });

  it('İstisnai cebirler G2, F4, E6, E7, E8: boyut, |Δ+|, |W|, h, h^v, üsler', () => {
    const expected = [
      { t: 'G', r: 2, dim: 14, pos: 6, W: 12n, h: 6, hv: 4, det: 1, exp: [1, 5] },
      { t: 'F', r: 4, dim: 52, pos: 24, W: 1152n, h: 12, hv: 9, det: 1, exp: [1, 5, 7, 11] },
      { t: 'E', r: 6, dim: 78, pos: 36, W: 51840n, h: 12, hv: 12, det: 3, exp: [1, 4, 5, 7, 8, 11] },
      { t: 'E', r: 7, dim: 133, pos: 63, W: 2903040n, h: 18, hv: 18, det: 2, exp: [1, 5, 7, 9, 11, 13, 17] },
      { t: 'E', r: 8, dim: 248, pos: 120, W: 696729600n, h: 30, hv: 30, det: 1, exp: [1, 7, 11, 13, 17, 19, 23, 29] },
    ];
    for (const e of expected) {
      const alg = getAlgebra(e.t, e.r);
      assert.equal(alg.dimension, e.dim, `${e.t}${e.r} dim`);
      assert.equal(alg.numPositiveRoots, e.pos, `${e.t}${e.r} posRoots`);
      assert.equal(alg.weylOrder, e.W, `${e.t}${e.r} |W|`);
      assert.equal(alg.coxeterNumber, e.h, `${e.t}${e.r} h`);
      assert.equal(alg.dualCoxeterNumber, e.hv, `${e.t}${e.r} h^v`);
      assert.equal(alg.cartanDet, e.det, `${e.t}${e.r} det(A)`);
      assert.deepEqual(alg.exponents, e.exp, `${e.t}${e.r} exponents`);
    }
  });

  it('ortonormal basit kökler Cartan matrisi ve kök uzunluklarıyla tam uyuşur', () => {
    for (const alg of listAlgebras()) {
      const r = alg.rank;
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < r; j++) {
          const ri = alg.orthoSimpleRoots[i];
          const rj = alg.orthoSimpleRoots[j];
          const ip = ri.reduce((s, v, k) => s + v * rj[k], 0);
          const nj = rj.reduce((s, v) => s + v * v, 0);
          const aij = (2 * ip) / nj;
          assert.ok(Math.abs(aij - alg.cartan[i][j]) < 1e-9, `${alg.id}: A[${i}][${j}] uyuşmazlığı`);
        }
      }
    }
  });

  it('parseAlgebra fizik ve Cartan adlarını doğru çözümler', () => {
    assert.equal(parseAlgebra('su(3)').id, 'A2');
    assert.equal(parseAlgebra('SO(10)').id, 'D5');
    assert.equal(parseAlgebra('so(7)').id, 'B3');
    assert.equal(parseAlgebra('sp(6)').id, 'C3');
    assert.equal(parseAlgebra('E_8').id, 'E8');
  });
});

describe('Temsiller: Weyl boyut formülü, Freudenthal katlılıkları, Casimir, Dynkin indeksi', () => {
  it('SU(3) indirgenemez temsil boyutları: 1, 3, 6, 8, 10, 15, 27', () => {
    const A2 = getAlgebra('A', 2);
    const cases = [
      [[0, 0], 1n],
      [[1, 0], 3n],
      [[0, 1], 3n],
      [[2, 0], 6n],
      [[1, 1], 8n],
      [[3, 0], 10n],
      [[2, 1], 15n],
      [[4, 0], 15n],
      [[2, 2], 27n],
    ];
    for (const [hw, expected] of cases) {
      assert.equal(weylDimension(A2, hw), expected);
      assert.equal(su3Dim(hw[0], hw[1]), Number(expected));
      const ws = weightSystem(A2, hw);
      assert.equal(ws.truncated, false);
      assert.equal(BigInt(ws.totalMult), expected);
    }
  });

  it('SO(10) spinör 16 ve vektör 10, E6 27, E7 56, E8 eklenik 248, G2 temel 7, F4 26', () => {
    const D5 = getAlgebra('D', 5);
    assert.equal(weylDimension(D5, [1, 0, 0, 0, 0]), 10n);
    assert.equal(weylDimension(D5, [0, 0, 0, 0, 1]), 16n);
    assert.equal(weylDimension(D5, [0, 0, 0, 1, 0]), 16n);
    assert.equal(weylDimension(D5, [0, 1, 0, 0, 0]), 45n);
    assert.equal(weylDimension(D5, [0, 0, 0, 0, 2]), 126n);

    const E6 = getAlgebra('E', 6);
    assert.equal(weylDimension(E6, [1, 0, 0, 0, 0, 0]), 27n);
    assert.equal(weylDimension(E6, [0, 0, 0, 0, 1, 0]), 27n);
    assert.equal(weylDimension(E6, [0, 0, 0, 0, 0, 1]), 78n);

    const E7 = getAlgebra('E', 7);
    assert.equal(weylDimension(E7, [0, 0, 0, 0, 0, 1, 0]), 56n);
    assert.equal(weylDimension(E7, [1, 0, 0, 0, 0, 0, 0]), 133n);

    const E8 = getAlgebra('E', 8);
    assert.equal(weylDimension(E8, [0, 0, 0, 0, 0, 0, 1, 0]), 248n);
    assert.equal(weylDimension(E8, [1, 0, 0, 0, 0, 0, 0, 0]), 3875n);

    const G2 = getAlgebra('G', 2);
    assert.equal(weylDimension(G2, [0, 1]), 7n);
    assert.equal(weylDimension(G2, [1, 0]), 14n);
    assert.equal(weylDimension(G2, [0, 2]), 27n);

    const F4 = getAlgebra('F', 4);
    assert.equal(weylDimension(F4, [0, 0, 0, 1]), 26n);
    assert.equal(weylDimension(F4, [1, 0, 0, 0]), 52n);
  });

  it('Freudenthal ağırlık katlılık toplamları G2, B2, C2, D5(16), E6(27), E7(56), E8(248) için Weyl boyutuna eşittir', () => {
    const checks = [
      ['G', 2, [0, 1], 7],
      ['G', 2, [1, 0], 14],
      ['B', 2, [0, 1], 4],
      ['B', 2, [1, 0], 5],
      ['C', 2, [1, 0], 4],
      ['C', 2, [0, 1], 5],
      ['D', 5, [0, 0, 0, 0, 1], 16],
      ['E', 6, [1, 0, 0, 0, 0, 0], 27],
      ['E', 7, [0, 0, 0, 0, 0, 1, 0], 56],
      ['E', 8, [0, 0, 0, 0, 0, 0, 1, 0], 248],
    ];
    for (const [t, r, hw, expected] of checks) {
      const alg = getAlgebra(t, r);
      const ws = weightSystem(alg, hw);
      assert.equal(ws.truncated, false, `${alg.id} truncated`);
      assert.equal(ws.totalMult, expected, `${alg.id} Freudenthal toplamı`);
    }
    // Check E8 adjoint zero weight has multiplicity 8 (= rank)
    const wsE8 = weightSystem(getAlgebra('E', 8), [0, 0, 0, 0, 0, 0, 1, 0]);
    const zeroWt = wsE8.weights.find(w => w.dynkin.every(x => x === 0));
    assert.equal(zeroWt.mult, 8);
  });

  it('Kuadratik Casimir C2 ve Dynkin indeksi T standart fizik normalizasyonunu sağlar', () => {
    assert.ok(CASIMIR_NORMALIZATION.includes('1/2'));
    // SU(N) fundamental: T = 1/2, C2 = (N^2-1)/(2N); adjoint: T = C2 = N
    for (let r = 1; r <= 6; r++) {
      const alg = getAlgebra('A', r);
      const N = r + 1;
      const fund = Array(r).fill(0); fund[0] = 1;
      assert.equal(ratEq(dynkinIndex(alg, fund), rat(1, 2)), true, `A${r} T(fund)`);
      assert.equal(ratEq(casimirC2(alg, fund), rat(N * N - 1, 2 * N)), true, `A${r} C2(fund)`);
      const adj = alg.highestRoot.dynkin;
      assert.equal(ratEq(dynkinIndex(alg, adj), rat(N, 1)), true, `A${r} T(adj)`);
      assert.equal(ratEq(casimirC2(alg, adj), rat(N, 1)), true, `A${r} C2(adj)`);
    }
    // Every simple algebra's adjoint has C2(adj) = T(adj) = h^v
    for (const [t, r] of [['B', 3], ['C', 3], ['D', 4], ['D', 5], ['G', 2], ['F', 4], ['E', 6], ['E', 7], ['E', 8]]) {
      const alg = getAlgebra(t, r);
      const adj = alg.highestRoot.dynkin;
      assert.equal(weylDimension(alg, adj), BigInt(alg.dimension));
      assert.equal(ratEq(casimirC2(alg, adj), rat(alg.dualCoxeterNumber, 1)), true, `${alg.id} C2(adj) = h^v`);
      assert.equal(ratEq(dynkinIndex(alg, adj), rat(alg.dualCoxeterNumber, 1)), true, `${alg.id} T(adj) = h^v`);
    }
    // SO(10) vector T = 1, spinor 16 T = 2
    const D5 = getAlgebra('D', 5);
    assert.equal(ratEq(dynkinIndex(D5, [1, 0, 0, 0, 0]), rat(1, 1)), true);
    assert.equal(ratEq(dynkinIndex(D5, [0, 0, 0, 0, 1]), rat(2, 1)), true);
  });

  it('Gerçellik, eşlenik ve denklik sınıfı (N-ality) doğru çalışır', () => {
    const A2 = getAlgebra('A', 2);
    assert.deepEqual(conjugateWeight(A2, [1, 0]), [0, 1]);
    assert.equal(repReality(A2, [1, 0]).kind, 'complex');
    assert.equal(repReality(A2, [1, 1]).kind, 'real');
    assert.equal(congruenceClass(A2, [1, 0]).value, 1);
    assert.equal(congruenceClass(A2, [0, 1]).value, 2);
    assert.equal(congruenceClass(A2, [1, 1]).value, 0);

    const A1 = getAlgebra('A', 1);
    assert.equal(repReality(A1, [1]).kind, 'pseudoreal');
    assert.equal(repReality(A1, [2]).kind, 'real');

    const E7 = getAlgebra('E', 7);
    assert.equal(repReality(E7, [0, 0, 0, 0, 0, 1, 0]).kind, 'pseudoreal');
    assert.equal(repReality(E7, [1, 0, 0, 0, 0, 0, 0]).kind, 'real');
  });
});

describe('Weyl grubu, tensör çarpımları ve Young tabloları', () => {
  it('Weyl grubu eleman sayısı A2, B2, G2, A3 için beklenen mertebeye eşittir', () => {
    for (const [t, r, ord] of [['A', 2, 6], ['B', 2, 8], ['G', 2, 12], ['A', 3, 24]]) {
      const alg = getAlgebra(t, r);
      const W = weylGroupElements(alg, { maxSize: 30 });
      assert.equal(W.truncated, false);
      assert.equal(W.count, ord);
      // Poincare polynomial evaluated at 1 equals |W|
      const sum = W.poincarePoly.reduce((s, x) => s + (x || 0), 0);
      assert.equal(sum, ord);
    }
    // Weyl orbit of A2 fundamental weight [1,0] has size 3; [1,1] has size 6
    const A2 = getAlgebra('A', 2);
    assert.equal(weylOrbit(A2, [1, 0]).size, 3);
    assert.equal(weylOrbit(A2, [1, 1]).size, 6);
  });

  it('SU(3) tensör çarpımları: 3×3 = 6+3̄, 3×3̄ = 8+1, 8×8 = 27+10+10̄+8+8+1', () => {
    const A2 = getAlgebra('A', 2);

    const p33 = tensorProduct(A2, [1, 0], [1, 0]);
    assert.equal(p33.dimCheck, true);
    assert.equal(p33.indexCheck, true);
    assert.deepEqual(
      p33.terms.map(t => [t.hw, Number(t.dim), t.mult]),
      [[[2, 0], 6, 1], [[0, 1], 3, 1]],
    );

    const p33b = tensorProduct(A2, [1, 0], [0, 1]);
    assert.equal(p33b.dimCheck, true);
    assert.equal(p33b.indexCheck, true);
    assert.deepEqual(
      p33b.terms.map(t => [t.hw, Number(t.dim), t.mult]),
      [[[1, 1], 8, 1], [[0, 0], 1, 1]],
    );

    const p88 = tensorProduct(A2, [1, 1], [1, 1]);
    assert.equal(p88.dimCheck, true);
    assert.equal(p88.indexCheck, true);
    const map88 = new Map(p88.terms.map(t => [t.hw.join(','), t.mult]));
    assert.equal(map88.get('2,2'), 1); // 27
    assert.equal(map88.get('3,0'), 1); // 10
    assert.equal(map88.get('0,3'), 1); // 10bar
    assert.equal(map88.get('1,1'), 2); // 8 + 8
    assert.equal(map88.get('0,0'), 1); // 1

    // Sym^2(8) = 27 + 8 + 1 (dim 36), Alt^2(8) = 10 + 10bar + 8 (dim 28)
    const sq8 = symmetricAntisymmetricSquare(A2, [1, 1]);
    assert.equal(sq8.symDim, 36n);
    assert.equal(sq8.altDim, 28n);
  });

  it('G2 ve A3 tensör çarpımları boyut ve Dynkin indeks toplam kuralını sağlar', () => {
    const G2 = getAlgebra('G', 2);
    const g77 = tensorProduct(G2, [0, 1], [0, 1]); // 7 x 7 = 27 + 14 + 7 + 1
    assert.equal(g77.dimCheck, true);
    assert.equal(g77.indexCheck, true);
    assert.deepEqual(g77.terms.map(t => Number(t.dim)), [27, 14, 7, 1]);

    const A3 = getAlgebra('A', 3);
    const a44 = tensorProduct(A3, [1, 0, 0], [1, 0, 0]); // 4 x 4 = 10 + 6
    assert.equal(a44.dimCheck, true);
    assert.equal(a44.indexCheck, true);
    assert.deepEqual(a44.terms.map(t => Number(t.dim)), [10, 6]);
  });

  it('Young tabloları kanca-içerik formülü SU(N) için Weyl boyut formülüyle birebir örtüşür', () => {
    for (const [N, part] of [[3, [2, 1]], [3, [3, 0]], [4, [2, 1, 0]], [4, [1, 1]], [5, [2, 1, 1]], [5, [1, 1]]]) {
      const y = youngHooksAndContents(part, N);
      const alg = getAlgebra('A', N - 1);
      assert.equal(y.dim, weylDimension(alg, y.dynkin));
      assert.deepEqual(partitionToDynkin(dynkinToPartition(y.dynkin), N), y.dynkin);
    }
    assert.deepEqual(youngConjugate([1], 3), [1, 1]); // 3 -> 3bar
  });
});

describe('SU(2), Wigner d, Clebsch-Gordan, SU(1,1) ve salınıcı temsilleri', () => {
  it('SU(2) spin-j matrisleri [Jx,Jy]=iJz ve J^2=j(j+1)I sağlar', () => {
    for (const j of [0.5, 1, 1.5, 2, 2.5]) {
      const sp = su2SpinMatrices(j);
      assert.equal(sp.dim, Math.round(2 * j + 1));
      assert.equal(sp.checks.ok, true, `j=${j} komütatör hatası`);
    }
  });

  it('Spin-1/2 2π dönmede -I, 4π dönmede +I olur; Wigner d matrisi exp(-iβJy) ile eşleşir', () => {
    const U2pi = su2RotationMatrix(0.5, [0, 0, 1], 2 * Math.PI);
    const U4pi = su2RotationMatrix(0.5, [0, 0, 1], 4 * Math.PI);
    assert.ok(matMaxAbs(matAdd(U2pi, matEye(2))) < 1e-12);
    assert.ok(matMaxAbs(matSub(U4pi, matEye(2))) < 1e-12);

    const beta = 1.13;
    for (const j of [0.5, 1, 1.5]) {
      const wd = wignerSmallD(j, beta);
      const U = su2RotationMatrix(j, [0, 1, 0], beta);
      for (let r = 0; r < wd.matrix.length; r++) {
        for (let k = 0; k < wd.matrix.length; k++) {
          assert.ok(Math.abs(wd.matrix[r][k] - U[r][k].re) < 1e-9);
          assert.ok(Math.abs(U[r][k].im) < 1e-9);
        }
      }
    }
  });

  it('Clebsch-Gordan katsayıları 1/2 × 1/2 ve 1 × 1/2 için kesin değerleri ve birimliği sağlar', () => {
    // 1/2 x 1/2
    const c1 = clebschGordan(0.5, 0.5, 0.5, -0.5, 1, 0);
    const c2 = clebschGordan(0.5, -0.5, 0.5, 0.5, 1, 0);
    const c3 = clebschGordan(0.5, 0.5, 0.5, -0.5, 0, 0);
    const c4 = clebschGordan(0.5, -0.5, 0.5, 0.5, 0, 0);
    assert.equal(c1.sign, 1); assert.equal(c1.num, 1n); assert.equal(c1.den, 2n);
    assert.equal(c2.sign, 1); assert.equal(c2.num, 1n); assert.equal(c2.den, 2n);
    assert.equal(c3.sign, 1); assert.equal(c3.num, 1n); assert.equal(c3.den, 2n);
    assert.equal(c4.sign, -1); assert.equal(c4.num, 1n); assert.equal(c4.den, 2n);

    // 1 x 1/2 -> 3/2 + 1/2
    const d1 = clebschGordan(1, 1, 0.5, -0.5, 1.5, 0.5); // sqrt(1/3)
    const d2 = clebschGordan(1, 0, 0.5, 0.5, 1.5, 0.5);  // sqrt(2/3)
    const d3 = clebschGordan(1, 1, 0.5, -0.5, 0.5, 0.5); // sqrt(2/3)
    const d4 = clebschGordan(1, 0, 0.5, 0.5, 0.5, 0.5);  // -sqrt(1/3)
    assert.equal(d1.sign, 1); assert.equal(d1.num, 1n); assert.equal(d1.den, 3n);
    assert.equal(d2.sign, 1); assert.equal(d2.num, 2n); assert.equal(d2.den, 3n);
    assert.equal(d3.sign, 1); assert.equal(d3.num, 2n); assert.equal(d3.den, 3n);
    assert.equal(d4.sign, -1); assert.equal(d4.num, 1n); assert.equal(d4.den, 3n);

    // Orthogonality & unitarity for 1 x 1/2
    const dec = su2TensorDecomp(1, 0.5);
    assert.deepEqual(dec.JValues, [1.5, 0.5]);
    for (const st of dec.states) {
      const normSq = st.terms.reduce((s, t) => s + t.cg.value * t.cg.value, 0);
      assert.ok(Math.abs(normSq - 1) < 1e-12);
    }
  });

  it('SU(1,1) tanımlayıcı temsili, hiperbolik üstel gönderim ve ayrık seri', () => {
    const def = su11DefiningMatrices();
    assert.equal(def.checks.ok, true);
    const el = su11GroupElement(1.2, 0.7);
    assert.equal(el.preservesMetric, true);
    assert.ok(Math.abs(el.det.re - 1) < 1e-10 && Math.abs(el.det.im) < 1e-10);
    const ds = su11DiscreteSeries(1.5, '+', 5);
    assert.equal(ds.casimir, 0.75);
    assert.equal(ds.levels[0].downCoeff, 0);
    assert.equal(oscillatorSU2(3).degeneracy, 4);
    assert.equal(bohrAtomSO4(4).degeneracy, 16);
    assert.equal(oscillatorSU11('even').casimir, -3 / 16);
  });
});

describe('SU(3): Gell-Mann matrisleri, f_abc, d_abc, bazlar, Elliott ve Sekizli Yol', () => {
  it('[λ_a, λ_b] = 2i f_abc λ_c ve {λ_a, λ_b} = (4/3)δ_ab I + 2 d_abc λ_c tüm a,b için tutar', () => {
    const { lambdas } = gellMannMatrices();
    const { f, d } = su3StructureConstants();
    const I3 = matEye(3);

    // Known values
    assert.ok(Math.abs(f[0][1][2] - 1) < 1e-12);
    assert.ok(Math.abs(f[3][4][7] - Math.sqrt(3) / 2) < 1e-12);
    assert.ok(Math.abs(f[5][6][7] - Math.sqrt(3) / 2) < 1e-12);
    assert.ok(Math.abs(d[0][0][7] - 1 / Math.sqrt(3)) < 1e-12);

    // Total antisymmetry of f and total symmetry of d
    for (let a = 0; a < 8; a++) {
      for (let b = 0; b < 8; b++) {
        for (let k = 0; k < 8; k++) {
          assert.ok(Math.abs(f[a][b][k] + f[b][a][k]) < 1e-12);
          assert.ok(Math.abs(f[a][b][k] + f[a][k][b]) < 1e-12);
          assert.ok(Math.abs(d[a][b][k] - d[b][a][k]) < 1e-12);
          assert.ok(Math.abs(d[a][b][k] - d[a][k][b]) < 1e-12);
        }
      }
    }

    // Full commutation and anticommutation verification
    for (let a = 0; a < 8; a++) {
      for (let b = 0; b < 8; b++) {
        const lhsC = matComm(lambdas[a], lambdas[b]);
        let rhsC = matZero(3);
        for (let k = 0; k < 8; k++) {
          if (f[a][b][k] !== 0) rhsC = matAdd(rhsC, matScale(lambdas[k], c(0, 2 * f[a][b][k])));
        }
        assert.ok(matMaxAbs(matSub(lhsC, rhsC)) < 1e-11, `[λ_${a + 1}, λ_${b + 1}]`);

        const lhsA = matAntiComm(lambdas[a], lambdas[b]);
        let rhsA = a === b ? matScale(I3, 4 / 3) : matZero(3);
        for (let k = 0; k < 8; k++) {
          if (d[a][b][k] !== 0) rhsA = matAdd(rhsA, matScale(lambdas[k], 2 * d[a][b][k]));
        }
        assert.ok(matMaxAbs(matSub(lhsA, rhsA)) < 1e-11, `{λ_${a + 1}, λ_${b + 1}}`);
      }
    }
  });

  it('SU(3) bazları, Elliott dallanması ve Gell-Mann-Okubo kütle formülü', () => {
    const b = su3Bases();
    assert.equal(b.tripletWeights.length, 3);
    assert.ok(b.bases.alpha && b.bases.omega && b.bases.alphaPrime && b.bases.chevalley);
    // Chevalley check: [e1, f1] = h1, [e1, e2] = e3
    const ch = b.bases.chevalley.generators;
    const h1 = ch[0].matrix, e1 = ch[2].matrix, e2 = ch[3].matrix, e3 = ch[4].matrix, f1 = ch[5].matrix;
    assert.ok(matMaxAbs(matSub(matComm(e1, f1), h1)) < 1e-12);
    assert.ok(matMaxAbs(matSub(matComm(e1, e2), e3)) < 1e-12);

    // Elliott SU(3) -> SO(3) matches projection branchingRule('su3_so3')
    for (const [p, q] of [[1, 0], [2, 0], [1, 1], [3, 0], [2, 1]]) {
      const ell = elliottBranching(p, q);
      assert.equal(ell.ok, true);
      const br = branchingRule('su3_so3', [p, q]);
      assert.equal(br.dimCheck, true);
      for (const term of br.terms) {
        const L = term.subHws[0][0] / 2;
        assert.equal(ell.lMult.get(L), term.mult);
      }
    }

    // GMO accuracy (< 1% for baryon octet and decuplet)
    const gmoOct = gellMannOkuboCheck('baryonOctet');
    const gmoDec = gellMannOkuboCheck('baryonDecuplet');
    assert.ok(gmoOct.relErrPct < 1.0);
    assert.ok(gmoDec.relErrPct < 1.0);
  });
});

describe('Spinörler, Clifford cebiri, gömmeler ve dallanma kuralları', () => {
  it('Clifford matrisleri d=2..8 için {Γ_μ, Γ_ν} = 2δ_μν ve Hermitlilik sağlar', () => {
    for (let d = 2; d <= 8; d++) {
      const cl = cliffordGammas(d);
      assert.equal(cl.check.ok, true, `d=${d} Clifford hatası`);
      assert.equal(cl.matrixSize, 1 << Math.floor(d / 2));
      assert.equal(cl.generators.length, (d * (d - 1)) / 2);
    }
    const f5 = fermionicOscillatorSpinor(5);
    assert.equal(f5.diracDim, 32);
    assert.equal(f5.weylDim, 16);
    assert.equal(f5.statesPlus.length, 16);
    assert.equal(f5.statesMinus.length, 16);
  });

  it('GUT ve klasik dallanma kuralları tam boyut ve alt-temsilleri verir', () => {
    // SU(5) -> SM: 5 = (3,1) + (1,2), 10 = (3,2) + (3bar,1) + (1,1)
    const sm5 = branchingRule('su5_sm', [1, 0, 0, 0]);
    assert.equal(sm5.dimCheck, true);
    assert.deepEqual(sm5.terms.map(t => Number(t.dim)), [3, 2]);

    const sm10 = branchingRule('su5_sm', [0, 1, 0, 0]);
    assert.equal(sm10.dimCheck, true);
    assert.deepEqual(sm10.terms.map(t => Number(t.dim)), [6, 3, 1]);

    // SO(10) -> SU(5): 16 = 10 + 5bar + 1
    const so10_16 = branchingRule('so10_su5', [0, 0, 0, 0, 1]);
    assert.equal(so10_16.dimCheck, true);
    assert.deepEqual(so10_16.terms.map(t => Number(t.dim)), [10, 5, 1]);

    // E6 -> SO(10): 27 = 16 + 10 + 1
    const e6_27 = branchingRule('e6_so10', [1, 0, 0, 0, 0, 0]);
    assert.equal(e6_27.dimCheck, true);
    assert.deepEqual(e6_27.terms.map(t => Number(t.dim)), [16, 10, 1]);

    // G2 -> SU(3): 7 = 3 + 3bar + 1
    const g2_7 = branchingRule('g2_su3', [0, 1]);
    assert.equal(g2_7.dimCheck, true);
    assert.deepEqual(g2_7.terms.map(t => Number(t.dim)), [3, 3, 1]);

    // SU(5) -> SO(5): 5 -> 5, 15 -> 14 + 1, 24 -> 14 + 10
    assert.deepEqual(branchingRule('su5_so5', [1, 0, 0, 0]).terms.map(t => Number(t.dim)), [5]);
    assert.deepEqual(branchingRule('su5_so5', [2, 0, 0, 0]).terms.map(t => Number(t.dim)), [14, 1]);
    assert.deepEqual(branchingRule('su5_so5', [1, 0, 0, 1]).terms.map(t => Number(t.dim)), [14, 10]);

    // Borel-de Siebenthal: deleting alpha_2 (mark 3) of G2 gives A2 (SU(3))!
    const bdsG2 = borelDeSiebenthal(getAlgebra('G', 2), 2);
    assert.equal(bdsG2.factors.length, 1);
    assert.equal(bdsG2.factors[0].id, 'A2');
  });
});

describe('Verma modülleri, Weyl karakteri, Serre, Kac-Moody ve Süper Cebirler', () => {
  it('sl2 Verma tekil vektörü ve rank-2 Weyl karakter formülü özdeşliği', () => {
    const vm = sl2VermaModule(3, 6);
    assert.equal(vm.quotientDim, 4);
    assert.equal(vm.singularAt, 4);
    assert.equal(vm.levels[4].isSingular, true);

    const vr2 = vermaRank2(getAlgebra('A', 2), [1, 1], 4);
    assert.equal(vr2.dim, 8n);
    assert.equal(vr2.singulars.length, 2);

    for (const [t, r, hw] of [['A', 1, [3]], ['A', 2, [1, 1]], ['B', 2, [1, 0]], ['G', 2, [0, 1]]]) {
      const ch = weylCharacterFormula(getAlgebra(t, r), hw);
      assert.equal(ch.verified, true, `${t}${r} Weyl karakter hatası`);
    }
  });

  it('Tüm bükülmemiş afin Kac-Moody cebirleri det(Ã)=0, marks·Ã=0, Ã·comarks=0 ve Sugawara c sağlar', () => {
    for (const alg of listAlgebras()) {
      const aff = affineAlgebra(alg.type, alg.rank);
      assert.equal(aff.detIsZero, true, `${aff.affineName} det != 0`);
      assert.equal(aff.leftNullOk, true, `${aff.affineName} marks*A != 0`);
      assert.equal(aff.rightNullOk, true, `${aff.affineName} A*comarks != 0`);
    }
    // SU(2)_1: c = 1*3/(1+2) = 1; SU(2)_2: c = 3/2; E8_1: c = 1*248/(1+30) = 8
    assert.equal(ratEq(sugawaraCentralCharge('A', 1, 1).cRat, rat(1, 1)), true);
    assert.equal(ratEq(sugawaraCentralCharge('A', 1, 2).cRat, rat(3, 2)), true);
    assert.equal(ratEq(sugawaraCentralCharge('E', 8, 1).cRat, rat(8, 1)), true);

    // Serre relations for G2: (ad e1)^4(e2)=0, (ad e2)^2(e1)=0 (Wait: A[1][0]=-1 => m=2, A[0][1]=-3 => m=4)
    const serG2 = serreRelations(getAlgebra('G', 2));
    const r12 = serG2.relations.find(x => x.i === 1 && x.j === 2);
    const r21 = serG2.relations.find(x => x.i === 2 && x.j === 1);
    assert.equal(r12.power, 2); // 1 - A[1][0] = 1 - (-1) = 2
    assert.equal(r21.power, 4); // 1 - A[0][1] = 1 - (-3) = 4

    // Integrable affine weights at level 1 of SU(2): 2 weights (j=0, j=1/2)
    assert.equal(integrableAffineWeights('A', 1, 1).count, 2);
  });

  it('Süper cebirler listesi ve süper-Dynkin diyagramları', () => {
    assert.equal(SUPER_ALGEBRAS.length, 9);
    const sl21 = superDynkinDiagram('sl', 2, 1, 'distinguished');
    assert.equal(sl21.nodes.length, 2);
    assert.equal(sl21.oddCount, 1);

    const osp22 = superDynkinDiagram('osp', 2, 1);
    assert.equal(osp22.edges[0].mult, 1);

    const osp24 = superDynkinDiagram('osp', 2, 2);
    assert.equal(osp24.edges[1].mult, 2);

    const osp42 = superDynkinDiagram('osp', 4, 1);
    assert.equal(osp42.nodes.length, 3);
  });

  it('Alıştırma üreteci 4 bölümün tüm 21 soru tipini tekrar etmeyen şıklarla üretir', () => {
    let seed = 1337;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const allTopics = Object.values(LIE_QUIZ_TOPICS).flat();
    for (const diff of ['kolay', 'orta', 'zor']) {
      for (const tp of allTopics) {
        const q = generateLieQuizQuestion(diff, rng, tp);
        assert.ok(q.prompt.length > 5, `${tp} prompt`);
        assert.equal(q.options.length, 4, `${tp} options len`);
        assert.equal(new Set(q.options).size, 4, `${tp} (${diff}) duplicate options: ${JSON.stringify(q.options)}`);
        assert.ok(q.answerIndex >= 0 && q.answerIndex < 4, `${tp} answerIndex`);
        assert.ok(q.explanation.length > 5, `${tp} explanation`);
      }
    }
  });

  it('lie-tabs.js TABS arayüzü, tüm ikonlar, ders hedefleri ve 24 sekmenin mount/cleanup döngüsü geçerlidir', async () => {
    const noop = () => {};
    const makeStubEl = () => {
      const el = {
        innerHTML: '',
        textContent: '',
        className: '',
        value: '0',
        style: {},
        dataset: {},
        isConnected: true,
        clientWidth: 640,
        parentElement: null,
        width: 0,
        height: 0,
        addEventListener: noop,
        removeEventListener: noop,
        getContext: () => ({
          setTransform: noop, clearRect: noop, beginPath: noop, closePath: noop,
          moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, stroke: noop, fill: noop,
          fillText: noop, save: noop, restore: noop, setLineDash: noop,
        }),
        querySelector: () => makeStubEl(),
        querySelectorAll: () => [],
        closest: () => null,
        scrollIntoView: noop,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 240 }),
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      };
      el.parentElement = { clientWidth: 640 };
      return el;
    };

    globalThis.matchMedia ??= () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
    globalThis.addEventListener ??= noop;
    globalThis.removeEventListener ??= noop;
    globalThis.dispatchEvent ??= noop;
    globalThis.requestAnimationFrame ??= () => 0;
    globalThis.cancelAnimationFrame ??= noop;
    globalThis.getComputedStyle ??= () => ({ getPropertyValue: () => '#60a5fa' });
    globalThis.window ??= globalThis;
    globalThis.document ??= {
      hidden: false,
      hasFocus: () => true,
      head: { append: noop },
      documentElement: { dataset: {}, classList: { contains: () => false, toggle: noop } },
      body: { dataset: {} },
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => makeStubEl(),
    };

    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (...args) => {
      const h = origSetTimeout(...args);
      h?.unref?.();
      return h;
    };
    let tabsMod, uiMod, lessonsMod;
    try {
      tabsMod = await import('../js/lie-tabs.js');
      uiMod = await import('../js/ui.js');
      lessonsMod = await import('../js/lie-lessons.js');
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }

    const { TABS } = tabsMod;
    assert.ok(Array.isArray(TABS));
    assert.equal(TABS.length, 24);

    const validChapters = new Set(['su2', 'su3', 'lie', 'otesi']);
    const ids = new Set();
    for (const tab of TABS) {
      assert.ok(/^[a-z0-9-]+$/.test(tab.id), `Geçersiz sekme id: ${tab.id}`);
      assert.equal(ids.has(tab.id), false, `Yinelenen sekme id: ${tab.id}`);
      ids.add(tab.id);
      assert.ok(validChapters.has(tab.chapter), `Geçersiz bölüm: ${tab.chapter}`);
      assert.equal(tab.usesGroup, false, `usesGroup false olmalı: ${tab.id}`);
      assert.equal(typeof tab.title, 'string');
      assert.equal(typeof tab.mount, 'function');
      const svg = uiMod.icon(tab.icon);
      assert.ok(svg.startsWith('<svg'), `Geçersiz sekme ikonu: ${tab.icon}`);
    }

    // Every chapter must have lessons + exercises tabs
    for (const ch of validChapters) {
      assert.ok(TABS.some(t => t.chapter === ch && t.id.endsWith('-konu')), `${ch} konu sekmesi eksik`);
      assert.ok(TABS.some(t => t.chapter === ch && t.id.endsWith('-alistirma')), `${ch} alıştırma sekmesi eksik`);
    }

    // Every apply.tab target in lessons must exist in TABS
    const allLessons = [
      ...lessonsMod.SU2_LESSONS,
      ...lessonsMod.SU3_LESSONS,
      ...lessonsMod.LIE_LESSONS,
      ...lessonsMod.OTESI_LESSONS,
    ];
    for (const l of allLessons) {
      assert.ok(ids.has(l.apply.tab), `Ders Uygula hedefi bulunamadı: ${l.id} -> ${l.apply.tab}`);
    }

    // Scan every icon('...') call in all lie-*.js files
    for (const fname of ['../js/lie-tabs.js', '../js/lie-ui.js', '../js/lie-tabs-su.js', '../js/lie-tabs-class.js', '../js/lie-tabs-adv.js']) {
      const src = readFileSync(new URL(fname, import.meta.url), 'utf8');
      for (const m of src.matchAll(/icon\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g)) {
        assert.ok(uiMod.icon(m[1]).startsWith('<svg'), `${fname} içinde tanımsız ikon: ${m[1]}`);
      }
    }

    // Mount and cleanly unmount every single tab
    for (const tab of TABS) {
      const host = makeStubEl();
      const cleanFns = [];
      const ctx = {
        clean: { add(fn) { if (typeof fn === 'function') cleanFns.push(fn); } },
        setGroup: noop,
        jumpTo: noop,
      };
      const ret = tab.mount(host, null, ctx);
      assert.ok(host.innerHTML.length > 40, `${tab.id} içerik üretmedi`);
      if (typeof ret === 'function') ret();
      for (const fn of cleanFns) fn();
    }
  });
});
