import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PERM_CONVENTION,
  cyclic,
  dihedral,
  symmetric,
  alternating,
  kleinFour,
  quaternion,
  unitGroup,
  directProduct,
  cubeRotations,
  buildGroup,
  order,
  orders,
  isAbelian,
  exponent,
  generate,
  subgroups,
  isSubgroup,
  isNormal,
  leftCosets,
  rightCosets,
  index,
  conjugacyClasses,
  center,
  centralizer,
  normalizer,
  commutatorSubgroup,
  quotient,
  isCyclic,
  cyclicGenerators,
  minimalGeneratingSet,
  isomorphismInvariants,
  isIsomorphic,
  findIsomorphism,
  identifyGroup,
  parseCycles,
  composePerm,
  invertPerm,
  formatCycles,
  cycleType,
  permOrder,
  permSign,
  toTranspositions,
  twoLineNotation,
  puzzleSolvability,
  isHomomorphism,
  kernel,
  image,
  extendHomomorphism,
  subgroupAsGroup,
  lagrangeCheck,
  cauchyCheck,
  sylowSubgroups,
  isSimple,
  verifyGroupAxioms,
  primeFactors,
  cayleyGraph,
  subgroupLattice,
  generateQuizQuestion,
} from '../js/group.js';

describe('Grup kurucuları ve grup aksiyomları', () => {
  const sampleGroups = [
    cyclic(1),
    cyclic(6),
    cyclic(12),
    cyclic(30),
    dihedral(3),
    dihedral(4),
    dihedral(6),
    dihedral(12),
    symmetric(2),
    symmetric(3),
    symmetric(4),
    symmetric(5),
    alternating(3),
    alternating(4),
    alternating(5),
    kleinFour(),
    quaternion(),
    unitGroup(8),
    unitGroup(10),
    unitGroup(15),
    unitGroup(24),
    directProduct(cyclic(2), cyclic(3)),
    directProduct(cyclic(2), cyclic(2)),
    directProduct(dihedral(3), cyclic(2)),
    cubeRotations(),
  ];

  it('her kurucu kapanış, birleşme, birim ve ters aksiyomlarını sağlar', () => {
    for (const G of sampleGroups) {
      const check = verifyGroupAxioms(G, { fullAssociativityLimit: 24 });
      assert.equal(check.ok, true, `${G.name} aksiyom hatası: ${check.error}`);
    }
  });

  it('kurucu mertebeleri ve etiketleri doğrudur', () => {
    assert.equal(symmetric(4).size, 24);
    assert.equal(symmetric(5).size, 120);
    assert.equal(alternating(4).size, 12);
    assert.equal(alternating(5).size, 60);
    assert.equal(dihedral(4).size, 8);
    assert.ok(dihedral(4).elements.includes('r²'));
    assert.ok(dihedral(4).elements.includes('sr'));
    assert.deepEqual(quaternion().elements, ['1', '-1', 'i', '-i', 'j', '-j', 'k', '-k']);
    assert.equal(unitGroup(8).size, 4);
    assert.equal(unitGroup(10).size, 4);
    assert.equal(cubeRotations().size, 24);
  });

  it('buildGroup spesifikasyonu ile tüm grup türleri üretilir', () => {
    const specs = [
      { kind: 'Z', n: 8 },
      { kind: 'D', n: 5 },
      { kind: 'S', n: 3 },
      { kind: 'A', n: 4 },
      { kind: 'V4' },
      { kind: 'Q8' },
      { kind: 'U', n: 12 },
      { kind: 'Cube' },
      { kind: 'Prod', left: { kind: 'Z', n: 2 }, right: { kind: 'Z', n: 3 } },
    ];
    for (const s of specs) {
      const G = buildGroup(s);
      assert.equal(verifyGroupAxioms(G).ok, true);
    }
  });
});

describe('Bilinen alt grup sayıları, Lagrange ve normallik', () => {
  it('|S4| = 24 ve S4 tam 30 alt gruba sahiptir', () => {
    const S4 = symmetric(4);
    assert.equal(S4.size, 24);
    const subs = subgroups(S4);
    assert.equal(subs.length, 30);
    for (const s of subs) {
      assert.equal(lagrangeCheck(S4, s.elements).divides, true);
    }
  });

  it('A4 tam 10 alt gruba sahiptir ve 6 mertebeli alt grubu yoktur', () => {
    const A4 = alternating(4);
    const subs = subgroups(A4);
    assert.equal(subs.length, 10);
    assert.equal(subs.some(s => s.order === 6), false);
    for (const s of subs) {
      assert.equal(lagrangeCheck(A4, s.elements).divides, true);
    }
  });

  it('D4 tam 10 alt gruba sahiptir', () => {
    const D4 = dihedral(4);
    const subs = subgroups(D4);
    assert.equal(subs.length, 10);
    for (const s of subs) {
      assert.equal(lagrangeCheck(D4, s.elements).divides, true);
    }
  });

  it('Q8 tam 6 alt gruba sahiptir ve her alt grubu normaldir', () => {
    const Q8 = quaternion();
    const subs = subgroups(Q8);
    assert.equal(subs.length, 6);
    for (const s of subs) {
      assert.equal(s.isNormal, true);
      assert.equal(isNormal(Q8, s.elements), true);
      assert.equal(lagrangeCheck(Q8, s.elements).divides, true);
    }
  });

  it('Z12 tam 6 alt gruba sahiptir ve her bölen için tektir', () => {
    const Z12 = cyclic(12);
    const subs = subgroups(Z12);
    assert.equal(subs.length, 6);
    assert.deepEqual(subs.map(s => s.order), [1, 2, 3, 4, 6, 12]);
  });

  it('A5 60 elemanlıdır ve basittir (öz ve aşikar olmayan normal alt grubu yoktur)', () => {
    const A5 = alternating(5);
    assert.equal(A5.size, 60);
    const subs = subgroups(A5);
    assert.equal(subs.length, 59);
    assert.equal(isSimple(A5), true);
    const normals = subs.filter(s => s.isNormal);
    assert.deepEqual(normals.map(s => s.order), [1, 60]);
    for (const s of subs) {
      assert.equal(lagrangeCheck(A5, s.elements).divides, true);
    }
  });

  it('S5 120 elemanlıdır, 156 alt gruba sahiptir ve yalnızca 3 normal alt grubu vardır', () => {
    const S5 = symmetric(5);
    assert.equal(S5.size, 120);
    const subs = subgroups(S5);
    assert.equal(subs.length, 156);
    const normals = subs.filter(s => s.isNormal);
    assert.deepEqual(normals.map(s => s.order), [1, 60, 120]);
    for (const s of subs) {
      assert.equal(lagrangeCheck(S5, s.elements).divides, true);
    }
  });

  it('sol ve sağ kosetler normal alt gruplarda çakışır, normal olmayanlarda ayrılır', () => {
    const S3 = symmetric(3);
    const subs = subgroups(S3);
    for (const s of subs) {
      const lc = leftCosets(S3, s.elements);
      const rc = rightCosets(S3, s.elements);
      assert.equal(lc.length, index(S3, s.elements));
      assert.equal(rc.length, index(S3, s.elements));
      const key = cs => cs.map(c => c.join(',')).sort().join('|');
      assert.equal(key(lc) === key(rc), s.isNormal);
    }
  });
});

describe('İzomorfizma, devirlilik ve kimlik tespiti', () => {
  it('V4 devirli değildir; Z6 devirlidir ve 2 üreteci vardır', () => {
    const V4 = kleinFour();
    assert.equal(isCyclic(V4), false);
    assert.deepEqual(cyclicGenerators(V4), []);
    const Z6 = cyclic(6);
    assert.equal(isCyclic(Z6), true);
    assert.deepEqual(cyclicGenerators(Z6), [1, 5]);
  });

  it('klasik izomorfizmalar ve izomorf olmayan çiftler doğru ayrılır', () => {
    assert.equal(isIsomorphic(unitGroup(8), kleinFour()), true);
    assert.equal(isIsomorphic(unitGroup(10), cyclic(4)), true);
    assert.equal(isIsomorphic(dihedral(3), symmetric(3)), true);
    assert.equal(isIsomorphic(directProduct(cyclic(2), cyclic(3)), cyclic(6)), true);
    assert.equal(isIsomorphic(directProduct(cyclic(2), cyclic(2)), cyclic(4)), false);
    assert.equal(isIsomorphic(dihedral(4), quaternion()), false);
    assert.equal(isIsomorphic(cubeRotations(), symmetric(4)), true);
    assert.equal(isIsomorphic(dihedral(6), symmetric(3)), false);
    assert.equal(isIsomorphic(dihedral(6), directProduct(symmetric(3), cyclic(2))), true);
    assert.equal(isIsomorphic(alternating(4), dihedral(6)), false);
  });

  it('findIsomorphism gerçek bir bijektif homomorfizma döndürür', () => {
    const U10 = unitGroup(10);
    const Z4 = cyclic(4);
    const phi = findIsomorphism(U10, Z4);
    assert.ok(phi);
    assert.equal(isHomomorphism(U10, Z4, phi), true);
    assert.equal(kernel(U10, Z4, phi).length, 1);
    assert.equal(image(U10, Z4, phi).length, 4);

    const Cube = cubeRotations();
    const S4 = symmetric(4);
    const psi = findIsomorphism(Cube, S4);
    assert.ok(psi);
    assert.equal(isHomomorphism(Cube, S4, psi), true);
    assert.equal(new Set(psi).size, 24);
  });

  it('identifyGroup bilinen grupları doğru tanır', () => {
    assert.equal(identifyGroup(unitGroup(8)).label, 'V_4');
    assert.equal(identifyGroup(unitGroup(10)).label, 'Z_4');
    assert.equal(identifyGroup(dihedral(3)).label, 'S_3');
    assert.equal(identifyGroup(directProduct(cyclic(2), cyclic(3))).label, 'Z_6');
    assert.equal(identifyGroup(cubeRotations()).label, 'S_4');
  });
});

describe('Merkez, eşlenik sınıflar, komütatör, normalleyici ve bölüm grubu', () => {
  it('D4 merkezi 2 elemanlı, S3 merkezi aşikardır', () => {
    const D4 = dihedral(4);
    const Z = center(D4);
    assert.equal(Z.length, 2);
    assert.deepEqual(Z.map(i => D4.elements[i]), ['e', 'r²']);
    assert.equal(center(symmetric(3)).length, 1);
    assert.equal(center(symmetric(4)).length, 1);
    assert.equal(center(quaternion()).length, 2);
  });

  it('S3 3 eşlenik sınıfa, S4 5 eşlenik sınıfa sahiptir ve sınıf denklemi tutar', () => {
    const S3 = symmetric(3);
    const S4 = symmetric(4);
    assert.equal(conjugacyClasses(S3).length, 3);
    assert.equal(conjugacyClasses(S4).length, 5);
    assert.deepEqual(conjugacyClasses(S4).map(c => c.length).sort((a, b) => a - b), [1, 3, 6, 6, 8]);

    for (const G of [dihedral(4), dihedral(5), quaternion(), S3, S4, alternating(4), alternating(5)]) {
      const classes = conjugacyClasses(G);
      const zSize = center(G).length;
      const nonCentralSum = classes
        .filter(cls => cls.length > 1)
        .reduce((sum, cls) => sum + index(G, centralizer(G, cls[0])), 0);
      assert.equal(zSize + nonCentralSum, G.size, `${G.name} için sınıf denklemi tutmalı`);
    }
  });

  it('S4 komütatör alt grubu A4 ve D4/Z(D4) ≅ V4', () => {
    const S4 = symmetric(4);
    const comm = commutatorSubgroup(S4);
    assert.equal(comm.length, 12);
    assert.equal(isIsomorphic(subgroupAsGroup(S4, comm), alternating(4)), true);

    const D4 = dihedral(4);
    const Q = quotient(D4, center(D4));
    assert.equal(Q.size, 4);
    assert.equal(isIsomorphic(Q, kleinFour()), true);
  });

  it('normalleyici alt grubu normal kılar ve normal alt grubun normalleyicisi tüm G olur', () => {
    const S4 = symmetric(4);
    for (const s of subgroups(S4)) {
      const N = normalizer(S4, s.elements);
      assert.equal(isSubgroup(S4, N), true);
      if (s.isNormal) assert.equal(N.length, S4.size);
      else assert.ok(N.length < S4.size);
    }
  });

  it('minimalGeneratingSet grubu gerçekten üretir ve doğru mertebededir', () => {
    assert.equal(minimalGeneratingSet(cyclic(12)).length, 1);
    assert.equal(minimalGeneratingSet(kleinFour()).length, 2);
    assert.equal(minimalGeneratingSet(quaternion()).length, 2);
    assert.equal(minimalGeneratingSet(symmetric(4)).length, 2);
    assert.equal(minimalGeneratingSet(symmetric(5)).length, 2);
    const Z2xZ2xZ2 = directProduct(kleinFour(), cyclic(2));
    const mg = minimalGeneratingSet(Z2xZ2xZ2);
    assert.equal(mg.length, 3);
    assert.equal(generate(Z2xZ2xZ2, mg).length, 8);
  });

  it('orders ve exponent istatistikleri doğrudur', () => {
    const D4 = dihedral(4);
    const om = orders(D4);
    assert.equal(om.get(1), 1);
    assert.equal(om.get(2), 5);
    assert.equal(om.get(4), 2);
    assert.equal(exponent(D4), 4);
    assert.equal(exponent(kleinFour()), 2);
    assert.equal(exponent(symmetric(4)), 12);
    assert.equal(isAbelian(kleinFour()), true);
    assert.equal(isAbelian(D4), false);
    assert.equal(order(D4, 1), 4);
  });
});

describe('Permütasyon yardımcıları ve 15-bulmaca paritesi', () => {
  it('sağdan sola bileşke, ters, devir tipi, mertebe ve işaret doğrudur', () => {
    assert.equal(PERM_CONVENTION, 'right-to-left');
    const c3 = parseCycles('(1 2 3)', 4);
    const t = parseCycles('(1 2)', 4);
    assert.equal(permSign(c3), 1);
    assert.equal(permSign(t), -1);
    assert.equal(permOrder(c3), 3);
    assert.deepEqual(cycleType(c3), [3, 1]);

    // Right-to-left: (1 2) ∘ (2 3) = (1 2 3)
    const p12 = parseCycles('(1 2)', 3);
    const p23 = parseCycles('(2 3)', 3);
    assert.equal(formatCycles(composePerm(p12, p23)), '(1 2 3)');
    assert.equal(formatCycles(parseCycles('(1 2)(2 3)', 3)), '(1 2 3)');

    // Inverse & two-line notation
    assert.equal(formatCycles(invertPerm(c3)), '(1 3 2)');
    assert.equal(formatCycles(composePerm(c3, invertPerm(c3))), 'e');
    const two = twoLineNotation(c3);
    assert.deepEqual(two.top, [1, 2, 3, 4]);
    assert.deepEqual(two.bottom, [2, 3, 1, 4]);
  });

  it('toTranspositions S4 içindeki her permütasyonu birebir yeniden oluşturur', () => {
    const S4 = symmetric(4);
    for (const p of S4.meta.perms) {
      const trans = toTranspositions(p);
      assert.equal(trans.length % 2 === 0 ? 1 : -1, permSign(p));
      let acc = [0, 1, 2, 3];
      for (let i = trans.length - 1; i >= 0; i--) {
        const [a, b] = trans[i];
        const tp = [0, 1, 2, 3];
        tp[a - 1] = b - 1;
        tp[b - 1] = a - 1;
        acc = composePerm(tp, acc);
      }
      assert.deepEqual(acc, p);
    }
  });

  it('15-bulmaca parite testi çözülebilir ve Sam Loyd durumlarını ayırır', () => {
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    assert.equal(puzzleSolvability(solved).solvable, true);
    // One legal slide (15 right)
    const legal1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15];
    assert.equal(puzzleSolvability(legal1).solvable, true);
    // Another legal slide (12 down from solved)
    const legal2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 13, 14, 15, 12];
    assert.equal(puzzleSolvability(legal2).solvable, true);
    // Sam Loyd unsolvable swap of 14 and 15
    const unsolvable = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0];
    assert.equal(puzzleSolvability(unsolvable).solvable, false);
  });
});

describe('Homomorfizma, Birinci İzomorfizma, Cauchy ve Sylow teoremleri', () => {
  it('sgn: S4 -> Z2 homomorfizması için ker = A4, im = Z2 ve S4/ker ≅ im', () => {
    const S4 = symmetric(4);
    const Z2 = cyclic(2);
    const map = S4.meta.perms.map(p => (permSign(p) === 1 ? 0 : 1));
    assert.equal(isHomomorphism(S4, Z2, map), true);
    const ker = kernel(S4, Z2, map);
    const im = image(S4, Z2, map);
    assert.equal(ker.length, 12);
    assert.equal(im.length, 2);
    assert.equal(isNormal(S4, ker), true);
    assert.equal(isIsomorphic(quotient(S4, ker), subgroupAsGroup(Z2, im)), true);
  });

  it('extendHomomorphism geçerli ve çelişkili üreteç atamalarını doğru ayırır', () => {
    const Z4 = cyclic(4);
    const Z3 = cyclic(3);
    const bad = extendHomomorphism(Z4, Z3, [[1, 1]]);
    assert.equal(bad.ok, false);
    assert.ok(bad.conflict);

    const Z6 = cyclic(6);
    const good = extendHomomorphism(Z6, Z3, [[1, 1]]);
    assert.equal(good.ok, true);
    assert.deepEqual(good.kernel, [0, 3]);
    assert.deepEqual(good.image, [0, 1, 2]);
    assert.equal(isIsomorphic(quotient(Z6, good.kernel), subgroupAsGroup(Z3, good.image)), true);
  });

  it('Cauchy ve Sylow teoremleri A5 ve S4 için sağlanır', () => {
    const A5 = alternating(5);
    for (const [p] of primeFactors(A5.size)) {
      assert.equal(cauchyCheck(A5, p).valid, true);
      const syl = sylowSubgroups(A5, p);
      assert.equal(syl.modCheck, true);
      assert.equal(syl.divCheck, true);
    }
    assert.equal(sylowSubgroups(A5, 2).count, 5);
    assert.equal(sylowSubgroups(A5, 3).count, 10);
    assert.equal(sylowSubgroups(A5, 5).count, 6);

    const S4 = symmetric(4);
    assert.equal(sylowSubgroups(S4, 2).count, 3);
    assert.equal(sylowSubgroups(S4, 3).count, 4);
  });

  it('isomorphismInvariants beklenen alanları eksiksiz döndürür', () => {
    const inv = isomorphismInvariants(symmetric(4));
    assert.equal(inv.order, 24);
    assert.equal(inv.isAbelian, false);
    assert.equal(inv.isCyclic, false);
    assert.equal(inv.subgroupCount, 30);
    assert.equal(inv.centerSize, 1);
    assert.deepEqual(inv.classSizes, [1, 3, 6, 6, 8]);
  });
});

describe('Cayley grafiği, alt grup kafesi ve quiz üreteci', () => {
  it('cayleyGraph üreteçlerle tüm grubu kapsar ve en kısa yollar doğru çarpımı verir', () => {
    const D4 = dihedral(4);
    const cg = cayleyGraph(D4, D4.meta.defaultGenerators);
    assert.equal(cg.allReached, true);
    assert.equal(cg.reachable.length, 8);
    assert.equal(cg.edges.length, 16);
    for (const [elem, steps] of cg.paths.entries()) {
      let cur = D4.e;
      for (const st of steps) cur = D4.mul(cur, st.gen);
      assert.equal(cur, elem);
    }
  });

  it('subgroupLattice Hasse diyagramı yalnızca doğrudan kapsama kenarları içerir', () => {
    const Z12 = cyclic(12);
    const lat = subgroupLattice(Z12);
    assert.equal(lat.subgroups.length, 6);
    // Z12 lattice is product of 2-chain (1,2,4) and 1-chain (1,3): 7 Hasse edges
    assert.equal(lat.edges.length, 7);

    const D4 = dihedral(4);
    const latD4 = subgroupLattice(D4);
    assert.equal(latD4.subgroups.length, 10);
    // Every edge must go strictly upward with divisible order
    for (const [lo, hi] of latD4.edges) {
      assert.ok(latD4.subgroups[hi].order > latD4.subgroups[lo].order);
      assert.equal(latD4.subgroups[hi].order % latD4.subgroups[lo].order, 0);
    }
  });

  it('quiz üreteci tüm 11 soru tipini (indeks ve ad ile) ve 3 zorluk seviyesini tutarlı üretir', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const typeKeys = [
      'order', 'subgroup', 'normal', 'subgroupCount', 'classEquation',
      'permSign', 'permCompose', 'cyclic', 'center', 'homomorphism', 'lagrange',
    ];
    for (const diff of ['kolay', 'orta', 'zor']) {
      for (const key of typeKeys) {
        const q = generateQuizQuestion(diff, rng, key);
        assert.ok(q.prompt.length > 5);
        assert.ok(q.options.length >= 2);
        assert.equal(new Set(q.options).size, q.options.length, `Tekrarlanan şık: ${q.type} (${diff})`);
        assert.ok(q.answerIndex >= 0 && q.answerIndex < q.options.length);
        assert.ok(q.explanation.length > 5);
      }
    }
  });

  it('groupcenter.js sözdizimi, içe aktarımları, sekmeleri ve app/index entegrasyonu geçerlidir', async () => {
    // Minimal DOM/browser stubs so Node can parse and link js/groupcenter.js end-to-end
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
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
    };

    // Temporarily unref timers created by fx.js idle watcher so the test process exits immediately
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (...args) => {
      const h = origSetTimeout(...args);
      h?.unref?.();
      return h;
    };
    let mod, uiMod;
    try {
      mod = await import('../js/groupcenter.js');
      uiMod = await import('../js/ui.js');
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }
    assert.equal(typeof mod.mountGroupCenter, 'function');
    assert.equal(mod.GROUP_TABS.length, 10);

    // Every icon referenced by GROUP_TABS and icon('...') calls in groupcenter.js must exist in ui.js
    for (const t of mod.GROUP_TABS) {
      const svg = uiMod.icon(t.icon);
      assert.ok(svg.startsWith('<svg'), `Geçersiz sekme ikonu: ${t.icon}`);
    }
    const gcSrc = readFileSync(new URL('../js/groupcenter.js', import.meta.url), 'utf8');
    for (const m of gcSrc.matchAll(/icon\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g)) {
      const svg = uiMod.icon(m[1]);
      assert.ok(svg.startsWith('<svg'), `groupcenter.js içinde tanımsız ikon: ${m[1]}`);
    }

    // Check index.html and app.js hooks
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const solarPos = html.indexOf('css/solar.css');
    const groupPos = html.indexOf('css/group.css');
    assert.ok(solarPos > 0 && groupPos > solarPos, 'css/group.css, css/solar.css sonrasında eklenmeli');

    const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
    assert.ok(appSrc.includes('grup: groupCenter'), 'app.js rota tablosunda grup: groupCenter olmalı');
    assert.ok(appSrc.includes("import('./groupcenter.js')"), 'app.js groupcenter.js modülünü dinamik yüklemeli');
    assert.ok(appSrc.includes('nav-desktop-only'), 'Grup Teorisi linki mobil dockta gizlenmeli');
  });
});

