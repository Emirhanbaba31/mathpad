import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  cyclic,
  dihedral,
  symmetric,
  alternating,
  kleinFour,
  quaternion,
  unitGroup,
  directProduct,
  buildGroup,
  semiDirect,
  automorphisms,
  semiDirectActions,
  dicyclic,
  binaryTetrahedral,
  binaryOctahedral,
  binaryIcosahedral,
  frobeniusT7,
  gl,
  sl,
  psl,
  psl2_7,
  gl3_2,
  delta3n2,
  delta6n2,
  hessian216,
  verifyGroupAxioms,
  isIsomorphic,
  isHomomorphism,
  center,
  quotient,
  subgroups,
} from '../js/group.js';

import {
  C,
  recognizeAlgebraic,
  conjugacyStructure,
  classMultiplicationTable,
  characterTable,
  characterInnerProduct,
  kroneckerProduct,
  symmetricAndAntisymmetricSquares,
  tensorPowerDecomp,
  restrictionAndInduction,
  molienSeries,
  partitions,
  conjugatePartition,
  hookLengths,
  hookDimension,
  standardYoungTableaux,
  murnaghanNakayama,
  snCharacterTableMN,
  fastIsSimple,
  compositionSeries,
  sylowAnalysis,
  sylowOrderScreen,
  FANO_POINTS,
  FANO_LINES,
  fanoActionPerm,
  p1ActionPerm,
  findPairMappers,
  psl27AndGl32Data,
  mckayGraph,
  SPORADIC_GROUPS,
  SIMPLE_GROUP_FAMILIES,
  chevalleyOrder,
  SU3_FINITE_SUBGROUPS,
  groupAppendixRow,
  appendixCatalogSpecs,
  generateRepQuizQuestion,
} from '../js/grouprep.js';

describe('Genişletilmiş grup kurucuları (js/group.js)', () => {
  it('tüm yeni kurucular grup aksiyomlarını ve beklenen mertebeleri sağlar', () => {
    const groups = [
      [dicyclic(2), 8],
      [dicyclic(3), 12],
      [dicyclic(5), 20],
      [binaryTetrahedral(), 24],
      [binaryOctahedral(), 48],
      [binaryIcosahedral(), 120],
      [frobeniusT7(), 21],
      [gl(2, 2), 6],
      [gl(2, 3), 48],
      [sl(2, 3), 24],
      [sl(2, 5), 120],
      [psl(2, 2), 6],
      [psl(2, 3), 12],
      [psl(2, 5), 60],
      [psl2_7(), 168],
      [gl3_2(), 168],
      [delta3n2(2), 12],
      [delta3n2(3), 27],
      [delta3n2(4), 48],
      [delta6n2(2), 24],
      [delta6n2(3), 54],
      [delta6n2(4), 96],
      [hessian216(), 216],
    ];
    for (const [G, expectedOrder] of groups) {
      assert.equal(G.size, expectedOrder, `${G.name} mertebesi ${expectedOrder} olmalı`);
      const ax = verifyGroupAxioms(G, { fullAssociativityLimit: 24 });
      assert.equal(ax.ok, true, `${G.name} aksiyom hatası: ${ax.error}`);
    }
  });

  it('klasik izomorfizmalar: Q_4 ≅ Q_8, 2T ≅ SL(2,3), 2T/{±1} ≅ A_4, 2O/{±1} ≅ S_4, 2I/{±1} ≅ A_5, Δ(12) ≅ A_4, Δ(24) ≅ S_4', () => {
    assert.equal(isIsomorphic(dicyclic(2), quaternion()), true);
    assert.equal(isIsomorphic(binaryTetrahedral(), sl(2, 3)), true);
    assert.equal(isIsomorphic(psl(2, 3), alternating(4)), true);
    assert.equal(isIsomorphic(psl(2, 5), alternating(5)), true);
    assert.equal(isIsomorphic(delta3n2(2), alternating(4)), true);
    assert.equal(isIsomorphic(delta6n2(2), symmetric(4)), true);

    const T2 = binaryTetrahedral();
    assert.equal(isIsomorphic(quotient(T2, center(T2)), alternating(4)), true);
    const O2 = binaryOctahedral();
    assert.equal(isIsomorphic(quotient(O2, center(O2)), symmetric(4)), true);
    const I2 = binaryIcosahedral();
    assert.equal(isIsomorphic(quotient(I2, center(I2)), alternating(5)), true);
    const Q6 = dicyclic(3);
    assert.equal(isIsomorphic(quotient(Q6, center(Q6)), dihedral(3)), true);
  });

  it('yarı-direkt çarpım D_n = Z_n ⋊ Z_2, A_4 = V_4 ⋊ Z_3, S_4 = A_4 ⋊ Z_2 üretir ve otomorfizmaları sayar', () => {
    const Z5 = cyclic(5), Z2 = cyclic(2);
    const D5sd = semiDirect(Z5, Z2, (h, n) => (h === 0 ? n : (5 - n) % 5));
    assert.equal(isIsomorphic(D5sd, dihedral(5)), true);

    const V4 = kleinFour(), Z3 = cyclic(3);
    assert.equal(automorphisms(V4).length, 6); // Aut(V_4) ≅ S_3
    const { actions } = semiDirectActions(V4, Z3);
    assert.equal(actions.length, 3); // 1 trivial + 2 order-3 cyclic perms
    const nonTriv = actions.find(a => !a.isTrivial);
    const A4sd = semiDirect(V4, Z3, nonTriv.table);
    assert.equal(isIsomorphic(A4sd, alternating(4)), true);

    // buildGroup works for extended specs too
    assert.equal(buildGroup({ kind: 'T7' }).size, 21);
    assert.equal(buildGroup({ kind: 'Q2n', n: 3 }).size, 12);
    assert.equal(buildGroup({ kind: 'PSL27' }).size, 168);
    assert.equal(buildGroup({ kind: 'Delta3', n: 3 }).size, 27);
    assert.equal(buildGroup({ kind: 'Hessian' }).size, 216);
  });
});

describe('Karakter tabloları, diklik, cebirsel değerler ve Frobenius–Schur göstergesi', () => {
  const EXPECTED_DIMS = [
    [cyclic(6), [1, 1, 1, 1, 1, 1]],
    [kleinFour(), [1, 1, 1, 1]],
    [unitGroup(15), [1, 1, 1, 1, 1, 1, 1, 1]],
    [dihedral(3), [1, 1, 2]],
    [dihedral(4), [1, 1, 1, 1, 2]],
    [dihedral(5), [1, 1, 2, 2]],
    [dihedral(7), [1, 1, 2, 2, 2]],
    [quaternion(), [1, 1, 1, 1, 2]],
    [dicyclic(3), [1, 1, 1, 1, 2, 2]],
    [alternating(4), [1, 1, 1, 3]],
    [symmetric(4), [1, 1, 2, 3, 3]],
    [frobeniusT7(), [1, 1, 1, 3, 3]],
    [binaryTetrahedral(), [1, 1, 1, 2, 2, 2, 3]],
    [delta3n2(3), [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3]],
    [binaryOctahedral(), [1, 1, 2, 2, 2, 3, 3, 4]],
    [delta6n2(3), [1, 1, 2, 2, 2, 2, 3, 3, 3, 3]],
    [alternating(5), [1, 3, 3, 4, 5]],
    [symmetric(5), [1, 1, 4, 4, 5, 5, 6]],
    [binaryIcosahedral(), [1, 2, 2, 3, 3, 4, 4, 5, 6]],
    [psl2_7(), [1, 3, 3, 6, 7, 8]],
    [gl3_2(), [1, 3, 3, 6, 7, 8]],
    [hessian216(), [1, 1, 1, 2, 2, 2, 3, 8, 8, 8]],
  ];

  it('tüm gruplar için boyutlar, kareler toplamı ve satır/sütun dikliği sağlanır', () => {
    for (const [G, expDims] of EXPECTED_DIMS) {
      const ct = characterTable(G);
      assert.equal(ct.checks.ok, true, `${G.name} karakter tablosu doğrulaması başarısız: ${JSON.stringify(ct.checks)}`);
      assert.deepEqual(ct.irreps.map(ir => ir.dim), expDims, `${G.name} irrep boyutları eşleşmiyor`);
    }
  });

  it('A_4, T_7, A_5 ve PSL(2,7) karakter değerleri kesin cebirsel biçimde tanınır', () => {
    // A_4: ω and ω²
    const ctA4 = characterTable(alternating(4));
    assert.ok(ctA4.irreps.some(ir => ir.entries.some(e => e.latex === '\\omega')));
    assert.ok(ctA4.irreps.some(ir => ir.entries.some(e => e.latex === '\\omega^{2}')));

    // A_5: (1 ± √5)/2
    const ctA5 = characterTable(alternating(5));
    const a5Latex = ctA5.irreps.flatMap(ir => ir.entries.map(e => e.latex));
    assert.ok(a5Latex.includes('\\tfrac{1+\\sqrt{5}}{2}'), `A_5 içinde (1+√5)/2 bulunamadı: ${a5Latex.join(', ')}`);
    assert.ok(a5Latex.includes('\\tfrac{1-\\sqrt{5}}{2}'), `A_5 içinde (1-√5)/2 bulunamadı: ${a5Latex.join(', ')}`);

    // T_7 & PSL(2,7): (-1 ± i√7)/2
    for (const G of [frobeniusT7(), psl2_7()]) {
      const ct = characterTable(G);
      const lx = ct.irreps.flatMap(ir => ir.entries.map(e => e.latex));
      assert.ok(lx.includes('\\tfrac{-1+i\\sqrt{7}}{2}'), `${G.name} içinde (-1+i√7)/2 olmalı`);
      assert.ok(lx.includes('\\tfrac{-1-i\\sqrt{7}}{2}'), `${G.name} içinde (-1-i√7)/2 olmalı`);
    }
  });

  it('Frobenius–Schur göstergeleri gerçek (+1), karmaşık (0) ve sözde-gerçek (−1) temsilleri doğru sınıflar', () => {
    const fsOf = G => characterTable(G).irreps.map(ir => [ir.dim, ir.fsIndicator]);

    // Q_8: four real 1D + one pseudoreal 2D (-1)
    assert.deepEqual(fsOf(quaternion()), [[1, 1], [1, 1], [1, 1], [1, 1], [2, -1]]);

    // D_4: all five irreps real (+1)
    assert.deepEqual(fsOf(dihedral(4)), [[1, 1], [1, 1], [1, 1], [1, 1], [2, 1]]);

    // A_4: 1 real, two complex 1D, one real 3D
    assert.deepEqual(fsOf(alternating(4)), [[1, 1], [1, 0], [1, 0], [3, 1]]);

    // 2T: 1 real + 2 complex 1D, 1 pseudoreal 2D + 2 complex 2D, 1 real 3D
    const fs2T = fsOf(binaryTetrahedral());
    assert.equal(fs2T.filter(([d, f]) => d === 2 && f === -1).length, 1);
    assert.equal(fs2T.filter(([d, f]) => d === 2 && f === 0).length, 2);

    // 2I: spinors (2, 2, 4, 6) are pseudoreal (-1); tensors (1, 3, 3, 4, 5) are real (+1)
    const fs2I = fsOf(binaryIcosahedral());
    assert.equal(fs2I.filter(([, f]) => f === -1).length, 4);
    assert.equal(fs2I.filter(([, f]) => f === 1).length, 5);
    assert.deepEqual(fs2I.filter(([, f]) => f === -1).map(([d]) => d), [2, 2, 4, 6]);

    // PSL(2,7): 1 real, two complex 3D, 6, 7, 8 real
    assert.deepEqual(fsOf(psl2_7()), [[1, 1], [3, 0], [3, 0], [6, 1], [7, 1], [8, 1]]);
  });

  it('sınıf çarpım katsayıları K_i K_j = sum N_{ij}^k K_k tutarlıdır', () => {
    const S4 = symmetric(4);
    const { classes, classMult } = classMultiplicationTable(S4);
    for (let i = 0; i < classes.length; i++) {
      for (let j = 0; j < classes.length; j++) {
        let sum = 0;
        for (let k = 0; k < classes.length; k++) sum += classMult[i][j][k] * classes[k].size;
        assert.equal(sum, classes[i].size * classes[j].size);
      }
    }
  });
});

describe('Kronecker çarpımları, simetrik/antisimetrik kareler, gömmeler, indükleme ve Molien serisi', () => {
  it('A_4, Q_8 ve PSL(2,7) Kronecker çarpımları ile simetrik/antisimetrik kareler doğrudur', () => {
    // A_4: 3 ⊗ 3 = 1 ⊕ 1' ⊕ 1'' ⊕ 2·3, Sym²(3) = 1 ⊕ 1' ⊕ 1'' ⊕ 3 (dim 6), Λ²(3) = 3 (dim 3)
    const A4 = alternating(4);
    const ctA4 = characterTable(A4);
    const idx3 = ctA4.irreps.findIndex(ir => ir.dim === 3);
    const kpA4 = kroneckerProduct(A4, idx3, idx3);
    assert.equal(kpA4.dim, 9);
    assert.equal(kpA4.dimSum, 9);
    assert.equal(kpA4.terms.find(t => t.irrepIndex === idx3).mult, 2);
    const sqA4 = symmetricAndAntisymmetricSquares(A4, idx3);
    assert.equal(sqA4.symmetric.dimSum, 6);
    assert.equal(sqA4.antisymmetric.dimSum, 3);
    assert.equal(sqA4.invariantInSym, true);
    assert.equal(sqA4.invariantInAlt, false);

    // Q_8: 2 ⊗ 2 = 4×1D, invariant sits in Λ²(2) because ι = -1
    const Q8 = quaternion();
    const sqQ8 = symmetricAndAntisymmetricSquares(Q8, 4);
    assert.equal(sqQ8.symmetric.dimSum, 3);
    assert.equal(sqQ8.antisymmetric.dimSum, 1);
    assert.equal(sqQ8.invariantInSym, false);
    assert.equal(sqQ8.invariantInAlt, true);

    // PSL(2,7): 3 ⊗ 3̄ = 1 ⊕ 8; 3 ⊗ 3 = 3̄ ⊕ 6 (Λ²(3) = 3̄, Sym²(3) = 6)
    const P = psl2_7();
    const ctP = characterTable(P);
    const i3 = ctP.irreps.findIndex(ir => ir.dim === 3);
    const i3bar = ctP.irreps[i3].conjugateIndex;
    const kp33b = kroneckerProduct(P, i3, i3bar);
    assert.deepEqual(kp33b.terms.map(t => t.irrep.dim), [1, 8]);
    const sqP = symmetricAndAntisymmetricSquares(P, i3);
    assert.deepEqual(sqP.symmetric.terms.map(t => t.irrep.dim), [6]);
    assert.deepEqual(sqP.antisymmetric.terms.map(t => t.irrep.dim), [3]);
    assert.equal(sqP.antisymmetric.terms[0].irrepIndex, i3bar);
  });

  it('kısıtlama (dallanma), indükleme ve Frobenius karşılıklılığı sağlanır', () => {
    const cases = [
      [symmetric(4), 12],     // S_4 ↓ A_4
      [alternating(4), 4],    // A_4 ↓ V_4
      [frobeniusT7(), 7],     // T_7 ↓ Z_7
      [binaryOctahedral(), 24], // 2O ↓ 2T
      [alternating(5), 12],   // A_5 ↓ A_4
    ];
    for (const [G, subOrd] of cases) {
      const sub = subgroups(G).find(s => s.order === subOrd);
      const ri = restrictionAndInduction(G, sub.elements);
      assert.equal(ri.reciprocityOk, true, `${G.name} / |H|=${subOrd} Frobenius karşılıklılığı bozuk`);
      for (const r of ri.restrictions) assert.equal(r.dimSum, r.irrepG.dim);
      for (const ind of ri.inductions) assert.equal(ind.dimSum, ind.dim);
    }
  });

  it('Molien serisi D_3 (2B), A_4 (3B) ve 2I (2B Klein değişmezleri) için kesin katsayıları verir', () => {
    // D_3 2D: 1 / ((1-t^2)(1-t^3)) = 1, 0, 1, 1, 1, 1, 2, 1, 2, 2, 2
    const D3 = dihedral(3);
    const mD3 = molienSeries(D3, 2, 10);
    assert.deepEqual(mD3.molien, [1, 0, 1, 1, 1, 1, 2, 1, 2, 2, 2]);

    // A_4 3D: (1 + t^6) / ((1-t^2)(1-t^3)(1-t^4)) = 1, 0, 1, 1, 2, 1, 4, 2, 5
    const A4 = alternating(4);
    const mA4 = molienSeries(A4, 3, 8);
    assert.deepEqual(mA4.molien, [1, 0, 1, 1, 2, 1, 4, 2, 5]);

    // 2I faithful 2D: Klein invariants start at degree 12! M(t) = (1+t^30)/((1-t^12)(1-t^20))
    const I2 = binaryIcosahedral();
    const ctI2 = characterTable(I2);
    const i2d = ctI2.irreps.findIndex(ir => ir.dim === 2 && ir.isFaithful);
    const m2I = molienSeries(I2, i2d, 14);
    assert.deepEqual(m2I.molien.slice(0, 13), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe('Young tabloları, kanca uzunluğu formülü ve Murnaghan–Nakayama çapraz kontrolü', () => {
  it('tüm n ≤ 8 için sum (f^λ)^2 = n! ve standart tablolar f^λ adettir', () => {
    let fact = 1;
    for (let n = 1; n <= 8; n++) {
      fact *= n;
      const parts = partitions(n);
      const sumSq = parts.reduce((s, p) => s + hookDimension(p) ** 2, 0);
      assert.equal(sumSq, fact, `n=${n} için f^λ kareleri toplamı ${fact} olmalı`);
      if (n <= 5) {
        for (const p of parts) {
          const syt = standardYoungTableaux(p, 200);
          assert.equal(syt.tableaux.length, hookDimension(p));
        }
      }
    }
    assert.deepEqual(conjugatePartition([4, 2, 1]), [3, 2, 1, 1]);
    assert.deepEqual(hookLengths([3, 1]), [[4, 2, 1], [1]]);
  });

  it('Murnaghan–Nakayama S_2..S_5 için Burnside–Dixon karakter tablosuyla birebir örtüşür ve S_6 dikliğini sağlar', () => {
    for (let n = 2; n <= 5; n++) {
      const S = symmetric(n);
      const ct = characterTable(S);
      const mn = snCharacterTableMN(n);
      // Compare multisets of integer rows aligned by cycle type
      const classCycleTypes = ct.classes.map(cl => {
        const p = S.meta.perms[cl.rep];
        const lens = [];
        const seen = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          if (seen[i]) continue;
          let len = 0, cur = i;
          while (!seen[cur]) { seen[cur] = 1; len++; cur = p[cur]; }
          lens.push(len);
        }
        return lens.sort((a, b) => b - a).join(',');
      });
      const mnColIdx = classCycleTypes.map(ctStr => mn.partitions.findIndex(p => p.join(',') === ctStr));
      const mnRowsSorted = mn.table
        .map(row => mnColIdx.map(c => row[c]).join(','))
        .sort();
      const bdRowsSorted = ct.irreps
        .map(ir => ir.values.map(v => Math.round(v.re)).join(','))
        .sort();
      assert.deepEqual(mnRowsSorted, bdRowsSorted, `S_${n} Murnaghan–Nakayama ile Burnside–Dixon uyuşmadı`);
    }

    // S_6 (order 720, 11 irreps): verify orthogonality directly
    const mn6 = snCharacterTableMN(6);
    assert.equal(mn6.partitions.length, 11);
    for (let i = 0; i < 11; i++) {
      for (let j = i; j < 11; j++) {
        let s = 0;
        for (let k = 0; k < 11; k++) s += mn6.classSizes[k] * mn6.table[i][k] * mn6.table[j][k];
        assert.equal(s, i === j ? 720 : 0);
      }
    }
  });
});

describe('Basit gruplar, Sylow, Jordan–Hölder, PSL(2,7) ≅ GL(3,2), Fano ve McKay ADE', () => {
  it('basitlik, kompozisyon serisi ve Sylow sayıları doğru hesaplanır', () => {
    assert.equal(fastIsSimple(cyclic(7)), true);
    assert.equal(fastIsSimple(alternating(5)), true);
    assert.equal(fastIsSimple(psl2_7()), true);
    assert.equal(fastIsSimple(gl3_2()), true);
    assert.equal(fastIsSimple(symmetric(4)), false);
    assert.equal(fastIsSimple(binaryIcosahedral()), false);
    assert.equal(fastIsSimple(hessian216()), false);

    // Composition series
    for (const [G, solvable] of [
      [symmetric(4), true],
      [frobeniusT7(), true],
      [binaryOctahedral(), true],
      [hessian216(), true],
      [symmetric(5), false],
      [binaryIcosahedral(), false],
      [psl2_7(), false],
    ]) {
      const cs = compositionSeries(G);
      assert.equal(cs.factorOrderProduct, G.size, `${G.name} kompozisyon çarpan çarpımı |G| olmalı`);
      assert.equal(cs.isSolvable, solvable, `${G.name} çözülebilirlik yanlış`);
    }

    // Sylow counts of PSL(2,7): 168 = 2^3 * 3 * 7 -> n_2 = 21, n_3 = 28, n_7 = 8
    const sylP = sylowAnalysis(psl2_7());
    assert.deepEqual(sylP.map(s => [s.prime, s.count]), [[2, 21], [3, 28], [7, 8]]);
    for (const s of sylP) { assert.equal(s.modCheck, true); assert.equal(s.divCheck, true); }

    // Sylow order screener
    assert.equal(sylowOrderScreen(30).canBeNonAbelianSimple, false);
    assert.equal(sylowOrderScreen(56).canBeNonAbelianSimple, false);
    assert.equal(sylowOrderScreen(60).canBeNonAbelianSimple, true);
    assert.equal(sylowOrderScreen(168).canBeNonAbelianSimple, true);
  });

  it('PSL(2,7) ≅ GL(3,2) açık izomorfizması, Fano düzlemi doğruları ve iki kez geçişlilik doğrulanır', () => {
    const data = psl27AndGl32Data();
    assert.equal(data.isoPslToGl.length, 168);
    assert.equal(new Set(data.isoPslToGl).size, 168);
    assert.equal(isHomomorphism(data.PSL27, data.GL32, data.isoPslToGl), true);

    // Every GL(3,2) matrix maps every Fano line to a Fano line!
    const lineSet = new Set(FANO_LINES.map(l => l.slice().sort((a, b) => a - b).join(',')));
    for (const perm of data.fanoPermsGL) {
      for (const line of FANO_LINES) {
        const img = line.map(pt => perm[pt]).sort((a, b) => a - b).join(',');
        assert.ok(lineSet.has(img), `Fano doğrusu bozuldu: ${img}`);
      }
    }

    // Doubly transitive checks
    assert.equal(data.fanoTransitivity.isDoublyTransitive, true);
    assert.equal(data.fanoTransitivity.isTriplyTransitive, false);
    assert.equal(data.fanoTransitivity.pairStabilizerOrder, 4);
    assert.equal(data.p1Transitivity.isDoublyTransitive, true);
    assert.equal(data.p1Transitivity.pairStabilizerOrder, 3);
    assert.equal(findPairMappers(data.fanoPermsGL, 0, 1, 2, 6).length, 4);
    assert.equal(findPairMappers(data.p1PermsPSL, 0, 7, 3, 5).length, 3);
  });

  it('McKay karşılığı ADE genişletilmiş Dynkin diyagramlarını ve Cartan çekirdeğini tam üretir', () => {
    const cases = [
      [cyclic(6), 'Ã_5', 6, 6],
      [quaternion(), 'D̃_4', 5, 4],
      [dicyclic(3), 'D̃_5', 6, 5],
      [dicyclic(4), 'D̃_6', 7, 6],
      [binaryTetrahedral(), 'Ẽ_6', 7, 6],
      [binaryOctahedral(), 'Ẽ_7', 8, 7],
      [binaryIcosahedral(), 'Ẽ_8', 9, 8],
    ];
    for (const [G, ade, nNodes, nEdges] of cases) {
      const mk = mckayGraph(G);
      assert.equal(mk.adeType, ade);
      assert.equal(mk.nodes.length, nNodes);
      assert.equal(mk.edges.length, nEdges);
      assert.equal(mk.nullCheckOk, true, `${G.name} için (2I - A)d = 0 sağlanmalı`);
    }
  });
});

describe('26 Sporadik basit grup mertebeleri, Ek 1 ve alıştırma üreteci', () => {
  it('26 sporadik grubun tamamı ATLAS kesin BigInt mertebeleriyle eşleşir', () => {
    assert.equal(SPORADIC_GROUPS.length, 26);
    assert.equal(SPORADIC_GROUPS.filter(g => g.happy).length, 20);
    assert.equal(SPORADIC_GROUPS.filter(g => !g.happy).length, 6);
    assert.ok(SIMPLE_GROUP_FAMILIES.length >= 7);
    assert.ok(SU3_FINITE_SUBGROUPS.length >= 9);

    const expectedOrders = {
      M11: '7920',
      M12: '95040',
      M22: '443520',
      M23: '10200960',
      M24: '244823040',
      J1: '175560',
      J2: '604800',
      J3: '50232960',
      J4: '86775571046077562880',
      HS: '44352000',
      McL: '898128000',
      Suz: '448345497600',
      Co3: '495766656000',
      Co2: '42305421312000',
      Co1: '4157776806543360000',
      He: '4030387200',
      Ru: '145926144000',
      ON: '460815505920',
      Ly: '51765179004000000',
      HN: '273030912000000',
      Th: '90745943887872000',
      Fi22: '64561751654400',
      Fi23: '4089470473293004800',
      Fi24p: '1255205709190661721292800',
      B: '4154781481226426191177580544000000',
      M: '808017424794512875886459904961710757005754368000000000',
    };
    for (const g of SPORADIC_GROUPS) {
      assert.equal(g.orderStr, expectedOrders[g.id], `${g.id} mertebesi ATLAS değeriyle eşleşmeli`);
    }
  });

  it('Chevalley mertebe hesaplayıcı, Ek 1 kataloğu ve 3 bölümün alıştırma üreteci tutarlı çalışır', () => {
    assert.equal(chevalleyOrder('A', 1, 5).orderStr, '60');
    assert.equal(chevalleyOrder('A', 1, 7).orderStr, '168');
    assert.equal(chevalleyOrder('A', 2, 2).orderStr, '168');
    assert.equal(chevalleyOrder('G2', 2, 2).orderStr, '12096');
    assert.equal(chevalleyOrder('G2', 2, 2).simple, false);
    assert.equal(chevalleyOrder('E8', 8, 2).orderStr, '337804753143634806261388190614085595079991692242467651576160959909068800000');

    const catalog = appendixCatalogSpecs();
    assert.ok(catalog.length >= 30);
    for (const spec of catalog) {
      const G = buildGroup(spec);
      assert.ok(G.size >= 1);
    }

    const row = groupAppendixRow(alternating(4));
    assert.equal(row.order, 12);
    assert.equal(row.centerOrder, 1);
    assert.equal(row.abelianizationOrder, 3);
    assert.deepEqual(row.irrepDims, [1, 1, 1, 3]);

    let seed = 1337;
    const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const ch of ['sonlu', 'temsil', 'basitlik']) {
      for (const diff of ['kolay', 'orta', 'zor']) {
        for (let t = 0; t < 8; t++) {
          const q = generateRepQuizQuestion(ch, diff, rng);
          assert.ok(q.prompt.length > 8);
          assert.ok(q.options.length >= 2);
          assert.equal(new Set(q.options).size, q.options.length, `Tekrarlanan şık: ${q.type}`);
          assert.ok(q.answerIndex >= 0 && q.answerIndex < q.options.length);
          assert.ok(q.explanation.length > 8);
        }
      }
    }
    // Explicitly test every forced question type
    for (const [ch, tp] of [
      ['sonlu', 'youngHook'], ['sonlu', 'murnaghan'], ['sonlu', 'semiDirect'],
      ['temsil', 'charDim'], ['temsil', 'abelian1D'], ['temsil', 'fsIndicator'],
      ['temsil', 'kronecker'], ['temsil', 'molien'], ['temsil', 'branchingInd'], ['temsil', 'mckayCover'],
      ['basitlik', 'sylowSimple'], ['basitlik', 'sylowScreen'], ['basitlik', 'composition'], ['basitlik', 'pslFano'],
    ]) {
      const q = generateRepQuizQuestion(ch, 'orta', rng, tp);
      assert.equal(q.type, tp);
      assert.equal(new Set(q.options).size, q.options.length);
    }
  });

  it('grouprep-tabs.js, grouprep-lessons.js ve grouprep.css arayüz sözleşmesini sağlar', async () => {
    const noop = () => {};
    globalThis.matchMedia ??= () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
    globalThis.addEventListener ??= noop;
    globalThis.removeEventListener ??= noop;
    globalThis.dispatchEvent ??= noop;
    globalThis.window ??= globalThis;
    globalThis.document ??= {
      hidden: false,
      hasFocus: () => true,
      documentElement: { dataset: {}, classList: { contains: () => false, toggle: noop } },
      body: { dataset: {} },
      head: { append: noop },
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ rel: '', href: '' }),
    };

    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (...args) => {
      const h = origSetTimeout(...args);
      h?.unref?.();
      return h;
    };
    let tabsMod, lessonsMod, uiMod;
    try {
      tabsMod = await import('../js/grouprep-tabs.js');
      lessonsMod = await import('../js/grouprep-lessons.js');
      uiMod = await import('../js/ui.js');
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }

    const { TABS } = tabsMod;
    assert.ok(Array.isArray(TABS) && TABS.length >= 16, `En az 16 sekme bekleniyor, bulunan: ${TABS?.length}`);

    const validChapters = new Set(['sonlu', 'temsil', 'basitlik']);
    const seenIds = new Set();
    for (const tab of TABS) {
      assert.match(tab.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `Geçersiz kebab-id: ${tab.id}`);
      assert.ok(!seenIds.has(tab.id), `Tekrarlanan sekme kimliği: ${tab.id}`);
      seenIds.add(tab.id);
      assert.ok(validChapters.has(tab.chapter), `Geçersiz bölüm kimliği: ${tab.chapter}`);
      assert.equal(typeof tab.title, 'string');
      assert.ok(tab.title.length >= 3);
      assert.equal(typeof tab.usesGroup, 'boolean');
      assert.equal(typeof tab.mount, 'function');
      const svg = uiMod.icon(tab.icon);
      assert.ok(svg.startsWith('<svg'), `Geçersiz sekme ikonu: ${tab.icon}`);
    }

    // Check every chapter we own has tabs, and temsil & basitlik have lessons + exercises
    assert.ok(TABS.some(t => t.chapter === 'sonlu'));
    assert.ok(TABS.some(t => t.chapter === 'temsil' && t.id === 'temsil-konu'));
    assert.ok(TABS.some(t => t.chapter === 'temsil' && t.id === 'temsil-alistirma'));
    assert.ok(TABS.some(t => t.chapter === 'basitlik' && t.id === 'basitlik-konu'));
    assert.ok(TABS.some(t => t.chapter === 'basitlik' && t.id === 'basitlik-alistirma'));

    // Check every icon('...') call inside grouprep-tabs.js
    const tabsSrc = readFileSync(new URL('../js/grouprep-tabs.js', import.meta.url), 'utf8');
    for (const m of tabsSrc.matchAll(/icon\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g)) {
      const svg = uiMod.icon(m[1]);
      assert.ok(svg.startsWith('<svg'), `grouprep-tabs.js içinde tanımsız ikon: ${m[1]}`);
    }
    // Guard against unrendered raw LaTeX $...$ inside HTML templates (outside richTex definition & calls)
    const strippedRich = tabsSrc
      .replace(/function richTex[\s\S]*?\n\}/, '')
      .replace(/richTex\('[^']*'\)/g, '');
    const strayLatex = strippedRich.match(/\$[A-Za-z\\0-9][^$\n]{1,40}\$/g);
    assert.equal(strayLatex, null, `grouprep-tabs.js içinde işlenmemiş $...$ bulundu: ${strayLatex?.join(', ')}`);

    // Verify all lesson apply links point to valid tab ids and valid group specs
    const builtInTabs = new Set(['kesif', 'cayley', 'simetri', 'permutasyon', 'graf', 'altgrup', 'eslenik', 'homomorfizma', 'teoremler', 'quiz']);
    for (const l of [...lessonsMod.REP_LESSONS, ...lessonsMod.SIMPLE_LESSONS]) {
      assert.ok(seenIds.has(l.apply.tab) || builtInTabs.has(l.apply.tab), `Geçersiz ders hedef sekmesi: ${l.apply.tab}`);
      if (l.apply.spec) {
        const G = buildGroup(l.apply.spec);
        assert.ok(G.size >= 1);
      }
    }

    // Verify css/grouprep.css uses .grep- prefix and motion/responsive rules
    const cssSrc = readFileSync(new URL('../css/grouprep.css', import.meta.url), 'utf8');
    assert.ok(cssSrc.includes('.grep-ctbl'), 'css/grouprep.css .grep-ctbl içermeli');
    assert.ok(cssSrc.includes('data-motion="reduced"'), 'css/grouprep.css reduced motion kuralı içermeli');
    assert.ok(cssSrc.includes('data-motion="off"'), 'css/grouprep.css off motion kuralı içermeli');
    assert.ok(cssSrc.includes('@media (max-width: 820px)'), 'css/grouprep.css mobil medya sorgusu içermeli');
  });
});
