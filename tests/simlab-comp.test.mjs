import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  erf, normalCDF, normalInvCDF, solveLinearSystem, rk4Step, makeRng,
  SORT_COMPLEXITY, generateSortArray, sortTrace,
  GRAPH_PRESETS, runGraphAlgo, runAStarGrid,
  bstInsert, bstDelete, bstSearch, bstTraversals, heapPush, heapPop, hashCreate, hashInsert, hashSearch, hashDelete,
  scheduleCPU, simulatePageReplacement, bankersSafety, bankersRequest,
  simulateCache, simulatePipeline, floatToIEEE754, ieee754BitsToFloat, convertNumberBase,
  runAutomaton, nfaToDfa, regexToNfa, TM_PRESETS, runTM,
  generate2DDataset, createMLP, mlpTrainEpoch, kmeansInit, kmeansStep, linRegClosedForm, linRegGradStep, logRegGradStep,
  isPrime, gcd, modPow, rsaKeygen, rsaEncryptNum, rsaDecryptNum, caesarCipher, vigenereCipher, createSlidingWindow, stepSlidingWindow, dropInFlight,
  solveMM1, solveMMc, solveMM1K, createQueueSim, advanceQueueSim,
  solveLP2D, simplexSolve,
  solveEOQ, solveROP, simulateInventory,
  solveCPMPERT,
  SPC_CONSTANTS, generateSPCData, analyzeSPC,
  distStats, distPDF, cltSampleMeans, monteCarloPiBatch,
  normalizeTransitionMatrix, markovStep, markovPower, markovSteadyState, classifyMarkov,
  solveNorthwestCorner, solveVogel, optimizeMODI,
  ECG_PRESETS, ecgVectorAt, generateECGTrace,
  pkOneCompSingle, pkOneCompMulti, pkTwoComp,
  simulateHodgkinHuxley, fhnNullclines, simulateFHN,
  simulateEpidemic,
  simulateWindkessel, solvePoiseuilleStenosis,
  muscleForceLength, hillForceVelocity, hillCurve, solveElbowBiomechanics,
  createPhantom, computeSinogram, reconstructFBP, simulateUltrasound,
  rippleAmplitude, dopplerMetrics, standingWaveMetrics, beatsTrace,
  solveThinOptics, solveSnell, cauchyIndex, solvePrismRay, diffractionPattern,
  doublePendulumStep, doublePendulumEnergy, lorenzStep, logisticLyapunov, logisticBifurcation, classifyLinear2D, integrateLinear2D,
  ROOT_PRESETS, findRootBisection, findRootNewton, findRootSecant, integrateTrapezoid, integrateSimpson, integrateGaussLegendre, solveODECompare, evalLagrange, chebyshevNodes, buildCubicSpline, evalCubicSpline, polyLeastSquares,
  boxEigen, qhoEigen, superpositionWave, tunnelTransmission, hydrogenRadialProb, hydrogenWaveDensity,
  magnetCoilFlux, magnetCoilEmf, simulateFaradayPass, simulateLCEnergy,
  lorentzMetrics, solvePhotoelectric, solveCompton, COMPTON_PM, HC_EV_NM,
  compileExpr2D, evalVectorField2D, traceStreamline2D, computeLineIntegral2D, sampleSurfaceGrid, surfaceGradient,
  buffonExactProb, buffonDropBatch, createRandomWalkEnsemble, stepRandomWalkEnsemble, galtonBinomialPMF, galtonDropBatch,
} from '../js/simlab-comp-core.js';

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
// 0. SHARED MATH
// =====================================================================

describe('0. Ortak Matematik Yardımcıları', () => {
  test('erf, normalCDF ve normalInvCDF bilinen değerler ve ters ilişki', () => {
    approx(erf(0), 0, 1e-7);
    approx(erf(1), 0.84270079, 2e-6);
    approx(normalCDF(0), 0.5, 1e-7);
    approx(normalCDF(1.9599639845), 0.975, 2e-6);
    approx(normalInvCDF(0.95), 1.6448536, 1e-5);
    approx(normalInvCDF(0.975), 1.959964, 1e-5);
    approx(normalCDF(normalInvCDF(0.83)), 0.83, 1e-6);
  });

  test('solveLinearSystem ve rk4Step doğruluğu', () => {
    const x = solveLinearSystem([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3]);
    approx(x[0], 2, 1e-9); approx(x[1], 3, 1e-9); approx(x[2], -1, 1e-9);
    let y = [1];
    for (let i = 0; i < 100; i++) y = rk4Step((_t, [v]) => [v], i * 0.01, y, 0.01);
    approx(y[0], Math.E, 1e-8);
  });
});

// =====================================================================
// FIELD 1: BİLGİSAYAR (8 SIMULATIONS)
// =====================================================================

describe('1.1 Sıralama Algoritmaları', () => {
  test('Tüm 8 sıralama algoritması her veri deseninde doğru sıralar', () => {
    for (const pat of ['random', 'reversed', 'nearly', 'few']) {
      const arr = generateSortArray(18, pat, 101);
      const expected = arr.slice().sort((a, b) => a - b);
      for (const meta of SORT_COMPLEXITY) {
        const res = sortTrace(meta.id, arr);
        assert.deepEqual(res.sorted, expected, `${meta.id} (${pat}) yanlış sıraladı`);
        assert.ok(res.steps.length >= 2);
      }
    }
    const already = [1, 2, 3, 4, 5, 6];
    const b = sortTrace('bubble', already);
    assert.equal(b.swaps, 0, 'Sıralı dizide kabarcık sıralaması 0 takas yapmalı');
  });
});

describe('1.2 Graf Algoritmaları & A*', () => {
  test('BFS, DFS, Dijkstra, Bellman-Ford, Prim, Kruskal, Topolojik Sıralama', () => {
    const g = GRAPH_PRESETS.city;
    const bfs = runGraphAlgo({ algo: 'bfs', nodes: g.nodes, edges: g.edges, start: 0, directed: false });
    assert.equal(bfs.ok, true);
    assert.equal(bfs.dist[0], 0);
    assert.equal(bfs.dist[5], 3); // A -> B/C -> D/E -> F

    const dij = runGraphAlgo({ algo: 'dijkstra', nodes: g.nodes, edges: g.edges, start: 0, directed: false });
    assert.equal(dij.ok, true);
    // A(0)-C(2)=2, C(2)-B(1)=1 -> d[B]=3, B(1)-D(3)=5 -> d[D]=8, D(3)-E(4)=2 -> d[E]=10, E(4)-F(5)=3 -> d[F]=13
    assert.equal(dij.dist[1], 3);
    assert.equal(dij.dist[3], 8);
    assert.equal(dij.dist[4], 10);
    assert.equal(dij.dist[5], 13);

    const prim = runGraphAlgo({ algo: 'prim', nodes: g.nodes, edges: g.edges, start: 0, directed: false });
    const krus = runGraphAlgo({ algo: 'kruskal', nodes: g.nodes, edges: g.edges, start: 0, directed: false });
    assert.equal(prim.mstWeight, krus.mstWeight, 'Prim ve Kruskal aynı MST ağırlığını vermeli');
    assert.equal(prim.mstWeight, 13); // edges: (1,2)=1, (0,2)=2, (3,4)=2, (4,5)=3, (1,3)=5 => 13

    const neg = GRAPH_PRESETS.neg;
    const dijNeg = runGraphAlgo({ algo: 'dijkstra', nodes: neg.nodes, edges: neg.edges, start: 0, directed: true });
    assert.equal(dijNeg.ok, false);
    const bf = runGraphAlgo({ algo: 'bellman-ford', nodes: neg.nodes, edges: neg.edges, start: 0, directed: true });
    assert.equal(bf.ok, true);
    assert.equal(bf.hasNegCycle, false);
    assert.equal(bf.dist[1], 2); // S->B(7)->C(4)->A(2)
    assert.equal(bf.dist[4], 8); // S->B(7)->C(4)->T(8)

    const dag = GRAPH_PRESETS.dag;
    const topo = runGraphAlgo({ algo: 'topo', nodes: dag.nodes, edges: dag.edges, start: 0, directed: true });
    assert.equal(topo.hasCycle, false);
    assert.equal(topo.topoOrder.length, dag.nodes.length);
    for (const e of dag.edges) {
      assert.ok(topo.topoOrder.indexOf(e.u) < topo.topoOrder.indexOf(e.v));
    }
  });

  test('A* ızgara engel etrafında en kısa yolu bulur ve Dijkstra ile aynı maliyeti verir', () => {
    const walls = [];
    for (let r = 0; r < 9; r++) walls.push([r, 5]); // vertical barrier leaving gap at r=9..11
    const astar = runAStarGrid({ rows: 12, cols: 12, walls, start: [2, 2], goal: [2, 9], heuristic: 'manhattan' });
    const dij = runAStarGrid({ rows: 12, cols: 12, walls, start: [2, 2], goal: [2, 9], heuristic: 'dijkstra' });
    assert.equal(astar.found, true);
    assert.equal(astar.cost, dij.cost);
    assert.ok(astar.visitedCount <= dij.visitedCount);
  });
});

describe('1.3 Veri Yapıları (BST/AVL, Heap, Hash)', () => {
  test('AVL ağacı sıralı eklemede dengeli kalır ve rotasyon kaydeder', () => {
    let root = null, rotCount = 0;
    for (let v = 1; v <= 15; v++) {
      const r = bstInsert(root, v, { avl: true });
      root = r.root;
      rotCount += r.rotations.length;
    }
    const tr = bstTraversals(root);
    assert.equal(tr.size, 15);
    assert.equal(tr.isBalanced, true);
    assert.equal(tr.height, 4, '15 düğümlü tam AVL ağacı yüksekliği 4 olmalı');
    assert.ok(rotCount > 0);
    assert.equal(bstSearch(root, 11).found, true);
    const d = bstDelete(root, 8, { avl: true });
    assert.equal(d.removed, true);
    assert.equal(bstTraversals(d.root).isBalanced, true);
    assert.equal(bstSearch(d.root, 8).found, false);
  });

  test('Min-Heap ve Hash Table (chaining & linear probing) işlemleri', () => {
    let h = [];
    for (const v of [25, 10, 40, 5, 15, 2]) h = heapPush(h, v, true).arr;
    const out = [];
    while (h.length) { const p = heapPop(h, true); out.push(p.popped); h = p.arr; }
    assert.deepEqual(out, [2, 5, 10, 15, 25, 40]);

    // Linear probing with collisions and tombstone delete
    let tbl = hashCreate(7, 'linear');
    tbl = hashInsert(tbl, 10).tbl; // 10 % 7 = 3
    const r2 = hashInsert(tbl, 17); // 17 % 7 = 3 -> collision -> 4
    tbl = r2.tbl;
    assert.equal(r2.collision, true);
    assert.equal(r2.idx, 4);
    tbl = hashDelete(tbl, 10).tbl;
    assert.equal(hashSearch(tbl, 17).found, true, 'Silinen yuva sonrasındaki anahtar bulunmalı');
  });
});

describe('1.4 İşletim Sistemleri (CPU, Sayfa Değiştirme, Banker)', () => {
  test('CPU zamanlama (FCFS, SJF, SRTF, RR) metrik doğruluğu', () => {
    const procs = [
      { pid: 'P1', arrival: 0, burst: 8, priority: 2 },
      { pid: 'P2', arrival: 1, burst: 4, priority: 1 },
      { pid: 'P3', arrival: 2, burst: 9, priority: 3 },
      { pid: 'P4', arrival: 3, burst: 5, priority: 2 },
    ];
    const fcfs = scheduleCPU(procs, { algo: 'FCFS' });
    // P1:0-8(WT 0), P2:8-12(WT 7), P3:12-21(WT 10), P4:21-26(WT 18) => avgWT = 35/4 = 8.75
    approx(fcfs.avgWT, 8.75, 1e-6);
    const srtf = scheduleCPU(procs, { algo: 'SRTF' });
    // Silberschatz textbook SRTF example: avgWT = (9 + 0 + 15 + 2) / 4 = 6.5
    approx(srtf.avgWT, 6.5, 1e-6);
    assert.ok(srtf.avgWT < fcfs.avgWT);
    const rr = scheduleCPU(procs, { algo: 'RR', quantum: 3 });
    assert.equal(rr.makespan, 26);
  });

  test('Belady anomalisi: FIFO 4 çerçevede 3 çerçeveden fazla sayfa hatası verir', () => {
    const belady = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    const f3 = simulatePageReplacement(belady, 3, 'FIFO');
    const f4 = simulatePageReplacement(belady, 4, 'FIFO');
    assert.equal(f3.faults, 9);
    assert.equal(f4.faults, 10);
    assert.ok(f4.faults > f3.faults, 'Belady anomalisi gözlenmeli');
    const opt4 = simulatePageReplacement(belady, 4, 'OPT');
    const lru4 = simulatePageReplacement(belady, 4, 'LRU');
    assert.ok(opt4.faults <= lru4.faults);
  });

  test('Banker algoritması klasik Silberschatz örneği', () => {
    const state = {
      available: [3, 3, 2],
      max:        [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
      allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
    };
    const res = bankersSafety(state);
    assert.equal(res.safe, true);
    assert.equal(res.sequence.length, 5);
    const reqOk = bankersRequest({ ...state, pid: 1, request: [1, 0, 2] });
    assert.equal(reqOk.granted, true);
    const reqBad = bankersRequest({ ...state, pid: 0, request: [3, 3, 0] });
    assert.equal(reqBad.granted, false);
  });
});

describe('1.5 Bilgisayar Mimarisi (Önbellek, Boru Hattı, IEEE 754, Taban)', () => {
  test('Önbellek çatışması: 2-yollu küme ilişkili doğrudan eşlemeliyi yener', () => {
    const trace = [0x00, 0x100, 0x00, 0x100, 0x00, 0x100, 0x00, 0x100];
    const dm = simulateCache({ trace, cacheBytes: 256, blockBytes: 16, associativity: 1 });
    const sa2 = simulateCache({ trace, cacheBytes: 256, blockBytes: 16, associativity: 2 });
    assert.equal(dm.hits, 0);
    assert.equal(sa2.hits, 6);
  });

  test('5 aşamalı boru hattı veri iletme (forwarding) bekleme sayısını azaltır', () => {
    const prog = [
      { op: 'ADD', rd: '$t1', rs1: '$s0', rs2: '$s1', text: 'ADD $t1, $s0, $s1' },
      { op: 'SUB', rd: '$t2', rs1: '$t1', rs2: '$s2', text: 'SUB $t2, $t1, $s2' },
      { op: 'LW',  rd: '$t3', rs1: '$t2', rs2: null,  text: 'LW  $t3, 0($t2)' },
      { op: 'ADD', rd: '$t4', rs1: '$t3', rs2: '$t1', text: 'ADD $t4, $t3, $t1' },
    ];
    const withFwd = simulatePipeline(prog, { forwarding: true });
    const noFwd = simulatePipeline(prog, { forwarding: false });
    assert.equal(withFwd.stalls, 1, 'İletme açıkken sadece LW→ADD arası 1 stall olmalı');
    assert.ok(noFwd.stalls > withFwd.stalls);
  });

  test('IEEE 754 tek duyarlıklı ve İkiye Tümleyen dönüşümleri', () => {
    const f = floatToIEEE754(-3.5);
    assert.equal(f.hex, '0xC0600000');
    assert.equal(f.sign, 1);
    assert.equal(f.expUnbiased, 1);
    approx(ieee754BitsToFloat(f.bits).value, -3.5, 1e-7);
    assert.equal(floatToIEEE754(Infinity).kind, 'infinity');
    assert.equal(floatToIEEE754(NaN).kind, 'nan');

    const c = convertNumberBase('-5', 10, 8);
    assert.equal(c.ok, true);
    assert.equal(c.twosBin, '11111011');
    assert.equal(c.signedVal, -5);
    assert.equal(c.unsignedVal, 251);
  });
});

describe('1.6 Otomatlar & Turing Makinesi', () => {
  test('NFA→DFA alt küme inşası ve Regex→Thompson NFA eşdeğerliği', () => {
    // NFA: strings over {0,1} whose 2nd-to-last char is '1'
    const nfa = {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['0', '1'],
      start: 'q0',
      accepts: ['q2'],
      transitions: [
        { from: 'q0', sym: '0', to: 'q0' }, { from: 'q0', sym: '1', to: 'q0' },
        { from: 'q0', sym: '1', to: 'q1' },
        { from: 'q1', sym: '0', to: 'q2' }, { from: 'q1', sym: '1', to: 'q2' },
      ],
    };
    const dfa = nfaToDfa(nfa);
    for (const s of ['', '0', '1', '10', '11', '01', '00', '1010', '1101', '0011']) {
      assert.equal(runAutomaton(dfa, s).accepted, runAutomaton(nfa, s).accepted, `Fark: "${s}"`);
    }

    const rx = regexToNfa('(a|b)*abb');
    assert.equal(rx.ok, true);
    const jsRe = /^(a|b)*abb$/;
    for (const s of ['', 'a', 'abb', 'aabb', 'babb', 'abba', 'bbabb']) {
      assert.equal(runAutomaton(rx.nfa, s).accepted, jsRe.test(s), `Regex farkı: "${s}"`);
    }
  });

  test('Turing Makinesi hazır makineleri', () => {
    const r1 = runTM(TM_PRESETS['bin-inc'], '1011');
    assert.equal(r1.status, 'accept');
    assert.equal(r1.output, '1100');
    assert.equal(runTM(TM_PRESETS['bin-inc'], '111').output, '1000');

    assert.equal(runTM(TM_PRESETS.anbn, '0011').status, 'accept');
    assert.equal(runTM(TM_PRESETS.anbn, '001').status, 'reject');
    assert.equal(runTM(TM_PRESETS.palindrome, 'abba').status, 'accept');
    assert.equal(runTM(TM_PRESETS.palindrome, 'abab').status, 'reject');
    assert.equal(runTM(TM_PRESETS.parity, '101101').status, 'accept');
    assert.equal(runTM(TM_PRESETS.parity, '1011').status, 'reject');
  });
});

describe('1.7 Yapay Sinir Ağı (MLP), K-Means & Regresyon', () => {
  test('MLP doğrusal olmayan XOR veri setini öğrenir', () => {
    const data = generate2DDataset('xor', 80, 12);
    const net = createMLP([2, 8, 6, 1], 'tanh', 5);
    const first = mlpTrainEpoch(net, data, 0.35);
    let last = first;
    for (let e = 0; e < 260; e++) last = mlpTrainEpoch(net, data, 0.35);
    assert.ok(last.loss < first.loss * 0.4, `Kayıp yeterince düşmedi: ${first.loss} -> ${last.loss}`);
    assert.ok(last.acc >= 0.88, `XOR doğruluğu düşük: ${last.acc}`);
  });

  test('K-Means, Doğrusal ve Lojistik Regresyon yakınsaması', () => {
    const pts = [
      { x: -1, y: -1 }, { x: -0.9, y: -1.1 }, { x: 1, y: 1 }, { x: 1.1, y: 0.9 },
    ];
    let c = kmeansInit(pts, 2, 3);
    for (let i = 0; i < 10; i++) c = kmeansStep(pts, c).centroids;
    const fin = kmeansStep(pts, c);
    assert.ok(fin.inertia < 0.05);

    const linPts = [{ x: 0, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 7 }, { x: 3, y: 9 }];
    const cf = linRegClosedForm(linPts);
    approx(cf.w, 2, 1e-9); approx(cf.b, 3, 1e-9); approx(cf.r2, 1, 1e-9);
    let st = { w: 0, b: 0 };
    for (let i = 0; i < 300; i++) st = linRegGradStep(linPts, st, 0.1);
    approx(st.w, 2, 0.02); approx(st.b, 3, 0.02);

    const gData = generate2DDataset('gaussians', 80, 9);
    let lg = { w1: 0, w2: 0, b: 0 };
    for (let i = 0; i < 120; i++) lg = logRegGradStep(gData, lg, 0.5);
    assert.ok(lg.acc >= 0.9);
  });
});

describe('1.8 Kriptografi & Kayan Pencere', () => {
  test('RSA anahtar üretimi, şifreleme/çözme, Sezar & Vigenère', () => {
    const k = rsaKeygen(61, 53, 17);
    assert.equal(k.ok, true);
    assert.equal(k.n, 3233);
    assert.equal(k.phi, 3120);
    assert.equal(k.d, 2753);
    const c = rsaEncryptNum(65, k.e, k.n);
    assert.equal(c, 2790);
    assert.equal(rsaDecryptNum(c, k.d, k.n), 65);

    const ct = caesarCipher('Hello World', 7, false);
    assert.equal(caesarCipher(ct, 7, true), 'Hello World');
    const vt = vigenereCipher('ENGINEERING', 'KEY', false);
    assert.equal(vigenereCipher(vt, 'KEY', true), 'ENGINEERING');
  });

  test('Kayan pencere (GBN ve SR) paket kaybına rağmen tüm paketleri teslim eder', () => {
    for (const protocol of ['gbn', 'sr']) {
      const sim = createSlidingWindow({ protocol, windowSize: 3, totalPackets: 6, oneWayTime: 0.6, timeout: 1.8 });
      let dropped = false;
      for (let k = 0; k < 400 && !sim.done; k++) {
        stepSlidingWindow(sim, 0.1);
        if (!dropped) {
          const dataPkt = sim.flights.find(f => f.kind === 'DATA' && !f.lost);
          if (dataPkt) dropped = dropInFlight(sim, dataPkt.id);
        }
      }
      assert.equal(sim.done, true, `${protocol} tamamlanmadı`);
      assert.ok(sim.retransCount >= 1);
    }
  });
});

// =====================================================================
// FIELD 2: ENDÜSTRİ & YÖNEYLEM (8 SIMULATIONS)
// =====================================================================

describe('2.1 Kuyruk Teorisi (M/M/1, M/M/c, M/M/1/K)', () => {
  test('Analitik formüller, Erlang-C ve Little Yasası', () => {
    const mm1 = solveMM1(3, 4);
    assert.equal(mm1.stable, true);
    approx(mm1.rho, 0.75, 1e-9);
    approx(mm1.L, 3.0, 1e-9);
    approx(mm1.Lq, 2.25, 1e-9);
    approx(mm1.W, 1.0, 1e-9);
    approx(mm1.Wq, 0.75, 1e-9);
    approx(mm1.L, mm1.lambdaEff * mm1.W, 1e-9, 'Little Yasası');

    const mmc1 = solveMMc(3, 4, 1);
    approx(mmc1.L, mm1.L, 1e-9);
    const mmc2 = solveMMc(6, 4, 2); // a=1.5, c=2, rho=0.75 => P0 = 1/(1+1.5+4.5) = 1/7, Pwait=4.5/7, Lq=4.5/7*3 = 13.5/7
    approx(mmc2.P0, 1 / 7, 1e-8);
    approx(mmc2.Lq, 13.5 / 7, 1e-8);

    const mm1kEq = solveMM1K(4, 4, 4); // rho=1 => P0=PK=1/5, L=2
    approx(mm1kEq.P0, 0.2, 1e-9);
    approx(mm1kEq.L, 2.0, 1e-9);
    approx(mm1kEq.L, mm1kEq.lambdaEff * mm1kEq.W, 1e-9);

    // Discrete-event simulation converges to M/M/1 theoretical L and satisfies Little's Law
    const sim = createQueueSim({ model: 'mm1', lambda: 2, mu: 4, seed: 123 });
    const stats = advanceQueueSim(sim, 3000);
    relApprox(stats.L, 1.0, 0.12, 'M/M/1 benzetim L');
    relApprox(stats.L, stats.lambdaEff * stats.W, 0.03, 'Benzetim Little Yasası');
  });
});

describe('2.2 Doğrusal Programlama (Grafik & Simpleks)', () => {
  test('Klasik LP: Grafik ve Simpleks aynı optimal çözüm ve gölge fiyatları verir', () => {
    // Max 3x1 + 5x2 s.t. x1 <= 4, 2x2 <= 12, 3x1 + 2x2 <= 18 => (2, 6), Z = 36, duals = [0, 1.5, 1]
    const g = solveLP2D({
      sense: 'max', c1: 3, c2: 5,
      constraints: [
        { a: 1, b: 0, rhs: 4, op: '<=', name: 'K1' },
        { a: 0, b: 2, rhs: 12, op: '<=', name: 'K2' },
        { a: 3, b: 2, rhs: 18, op: '<=', name: 'K3' },
      ],
    });
    assert.equal(g.status, 'optimal');
    approx(g.optimalPoint.x, 2, 1e-6);
    approx(g.optimalPoint.y, 6, 1e-6);
    approx(g.optimalValue, 36, 1e-6);
    approx(g.shadowPrices[0].shadowPrice, 0, 1e-4);
    approx(g.shadowPrices[1].shadowPrice, 1.5, 1e-3);
    approx(g.shadowPrices[2].shadowPrice, 1.0, 1e-3);

    const sx = simplexSolve({ c: [3, 5], A: [[1, 0], [0, 2], [3, 2]], b: [4, 12, 18] });
    assert.equal(sx.status, 'optimal');
    approx(sx.solution[0], 2, 1e-8);
    approx(sx.solution[1], 6, 1e-8);
    approx(sx.optimalValue, 36, 1e-8);
    approx(sx.shadowPrices[0], 0, 1e-8);
    approx(sx.shadowPrices[1], 1.5, 1e-8);
    approx(sx.shadowPrices[2], 1.0, 1e-8);
  });
});

describe('2.3 Envanter & EOQ', () => {
  test('EOQ optimal noktada sipariş ve elde tutma maliyetleri eşittir; ROP emniyet stoku', () => {
    const eoq = solveEOQ({ D: 10000, S: 50, H: 4 });
    approx(eoq.Qopt, 500, 1e-8);
    approx(eoq.tcOpt, 2000, 1e-8);
    approx(eoq.holdCur, eoq.orderCur, 1e-8);
    const sub = solveEOQ({ D: 10000, S: 50, H: 4, Q: 800 });
    assert.ok(sub.tcCur > eoq.tcOpt);

    const rop = solveROP({ dailyMean: 40, dailyStd: 10, leadTime: 4, serviceLevel: 0.95 });
    approx(rop.sigmaL, 20, 1e-8);
    approx(rop.safetyStock, 20 * 1.6448536, 1e-3);
    approx(rop.rop, 160 + rop.safetyStock, 1e-3);

    const simLow = simulateInventory({ days: 200, dailyMean: 40, dailyStd: 10, leadTime: 4, Q: 500, rop: 150, seed: 5 });
    const simSafe = simulateInventory({ days: 200, dailyMean: 40, dailyStd: 10, leadTime: 4, Q: 500, rop: rop.rop, seed: 5 });
    assert.ok(simSafe.fillRate >= simLow.fillRate);
  });
});

describe('2.4 Proje Yönetimi (CPM/PERT)', () => {
  test('Kritik yol, bolluk (slack) ve PERT tamamlama olasılığı', () => {
    const acts = [
      { id: 'A', preds: [],    a: 2, m: 4, b: 6 }, // te=4, var=4/9
      { id: 'B', preds: ['A'], a: 3, m: 5, b: 7 }, // te=5, var=4/9
      { id: 'C', preds: ['A'], a: 1, m: 2, b: 3 }, // te=2
      { id: 'D', preds: ['B', 'C'], a: 4, m: 6, b: 14 }, // te=7, var=25/9
    ];
    const r = solveCPMPERT(acts, 16);
    assert.equal(r.ok, true);
    assert.deepEqual(r.criticalPath, ['A', 'B', 'D']);
    approx(r.projectDuration, 16, 1e-9);
    approx(r.projectVar, (4 + 4 + 25) / 9, 1e-9);
    approx(r.completionProb, 0.5, 1e-6);
    const nodeC = r.nodes.find(n => n.id === 'C');
    approx(nodeC.totalSlack, 3, 1e-9);
  });
});

describe('2.5 İstatistiksel Kalite Kontrol (SPC)', () => {
  test('Kontrol sınırları, Cp/Cpk ve kayma sonrası kontrol dışı algılama', () => {
    const clean = generateSPCData({ mu: 50, sigma: 1, n: 5, k: 30, shiftAt: 99, shiftSigma: 0, seed: 11 });
    const a1 = analyzeSPC({ subgroups: clean, USL: 54, LSL: 46 });
    assert.ok(a1.Cp > 1.0 && a1.Cp < 1.8);
    assert.ok(a1.Cpk <= a1.Cp + 1e-9);

    const shifted = generateSPCData({ mu: 50, sigma: 1, n: 5, k: 25, shiftAt: 12, shiftSigma: 3.5, seed: 11 });
    const a2 = analyzeSPC({ subgroups: shifted, USL: 54, LSL: 46 });
    assert.ok(a2.violations.length >= 1, '3.5σ kayması kontrol dışı uyarısı üretmeli');
  });
});

describe('2.6 Monte Carlo & Olasılık', () => {
  test('Ayrık PMF toplamı = 1, CLT standart sapması σ/√n, Monte Carlo π', () => {
    let binSum = 0;
    for (let k = 0; k <= 12; k++) binSum += distPDF('binomial', { n: 12, p: 0.35 }, k);
    approx(binSum, 1, 1e-8);
    let poiSum = 0;
    for (let k = 0; k <= 40; k++) poiSum += distPDF('poisson', { lambda: 4.5 }, k);
    approx(poiSum, 1, 1e-8);

    const clt = cltSampleMeans({ parent: 'exponential', n: 25, count: 1000, seed: 99 });
    approx(clt.theoMean, 1, 1e-9);
    approx(clt.theoStd, 0.2, 1e-9);
    approx(clt.empMean, 1, 0.05);
    approx(clt.empStd, 0.2, 0.03);

    const mc = monteCarloPiBatch(5000, 123);
    approx(mc.piEst, Math.PI, 0.08);
  });
});

describe('2.7 Markov Zincirleri', () => {
  test('Kararlı durum vektörü πP = π ve P^n yakınsaması', () => {
    const P = [[0.7, 0.3], [0.4, 0.6]];
    const ss = markovSteadyState(P);
    assert.equal(ss.unique, true);
    approx(ss.pi[0], 4 / 7, 1e-9);
    approx(ss.pi[1], 3 / 7, 1e-9);
    const next = markovStep(ss.pi, P);
    approx(next[0], ss.pi[0], 1e-9);
    const P30 = markovPower(P, 30);
    approx(P30[0][0], 4 / 7, 1e-6);
    assert.equal(classifyMarkov(P).isRegular, true);
    assert.deepEqual(classifyMarkov([[1, 0], [0.2, 0.8]]).absorbing, [0]);
  });
});

describe('2.8 Taşıma Problemi (NW, Vogel, MODI)', () => {
  test('MODI hem Kuzeybatı hem Vogel başlangıcından aynı optimal maliyeti bulur', () => {
    const prob = {
      costs: [[8, 6, 10, 9], [9, 12, 13, 7], [14, 9, 16, 5]],
      supply: [35, 50, 40],
      demand: [45, 20, 30, 30],
    };
    const nw = solveNorthwestCorner(prob);
    const vam = solveVogel(prob);
    assert.ok(vam.cost <= nw.cost);
    const optNW = optimizeMODI(prob, 'nw');
    const optVAM = optimizeMODI(prob, 'vogel');
    assert.equal(optNW.optimal, true);
    assert.equal(optVAM.optimal, true);
    approx(optNW.optimalCost, optVAM.optimalCost, 1e-6);
    approx(optNW.optimalCost, 1020, 1e-6); // Exact textbook optimal cost = 1020
    // Verify supply & demand conservation
    for (let i = 0; i < 3; i++) {
      approx(optNW.allocation[i].reduce((s, v) => s + v, 0), prob.supply[i], 1e-8);
    }
    for (let j = 0; j < 4; j++) {
      approx(optNW.allocation.reduce((s, r) => s + r[j], 0), prob.demand[j], 1e-8);
    }
  });
});

// =====================================================================
// FIELD 3: BİYOMEDİKAL (7 SIMULATIONS)
// =====================================================================

describe('3.1 EKG & Kalp Vektörü', () => {
  test('Einthoven Yasası (V_II = V_I + V_III) tüm örneklerde özdeş sağlanır', () => {
    for (const preset of Object.values(ECG_PRESETS)) {
      const tr = generateECGTrace(preset, 2.0, 200);
      for (let i = 0; i < tr.t.length; i++) {
        approx(tr.leadII[i], tr.leadI[i] + tr.leadIII[i], 1e-12, `Einthoven (${preset.label})`);
      }
    }
  });
});

describe('3.2 Farmakokinetik', () => {
  test('Tek kompartman IV yarı ömür, oral Tmax ve iki kompartman sabitleri', () => {
    const iv = pkOneCompSingle({ route: 'iv', dose: 400, Vd: 40, ke: 0.2, tEnd: 20, n: 400 });
    approx(iv.cmax, 10, 1e-9);
    approx(iv.halfLife, Math.LN2 / 0.2, 1e-9);
    approx(iv.auc, 400 / (0.2 * 40), 1e-9);
    // Check C(t_1/2) = C0/2
    const idxHalf = iv.t.reduce((bi, v, k) => Math.abs(v - iv.halfLife) < Math.abs(iv.t[bi] - iv.halfLife) ? k : bi, 0);
    approx(iv.C[idxHalf], 5, 0.08);

    const oral = pkOneCompSingle({ route: 'oral', dose: 500, Vd: 50, ke: 0.15, ka: 1.5, F: 0.8 });
    approx(oral.C[0], 0, 1e-12);
    approx(oral.tmax, Math.log(1.5 / 0.15) / (1.5 - 0.15), 1e-9);

    const two = pkTwoComp({ dose: 500, V1: 15, k10: 0.2, k12: 0.4, k21: 0.25 });
    approx(two.alpha * two.beta, 0.2 * 0.25, 1e-9);
    approx(two.alpha + two.beta, 0.2 + 0.4 + 0.25, 1e-9);
  });
});

describe('3.3 Sinir Hücresi (Hodgkin-Huxley & FitzHugh-Nagumo)', () => {
  test('Hodgkin-Huxley eşik davranışı, aksiyon potansiyeli ve TTX blokajı', () => {
    const quiet = simulateHodgkinHuxley({ Iinj: 0, tEnd: 30 });
    assert.equal(quiet.spikeCount, 0);
    approx(quiet.V[quiet.V.length - 1], -65, 1.5);

    const active = simulateHodgkinHuxley({ Iinj: 10, tPulseStart: 5, tPulseDur: 35, tEnd: 45 });
    assert.ok(active.spikeCount >= 2, `Aksiyon potansiyeli üretilmeli: ${active.spikeCount}`);
    assert.ok(active.peakV > 25, `Tepe potansiyeli > 25 mV olmalı: ${active.peakV}`);

    const ttx = simulateHodgkinHuxley({ Iinj: 15, gNaScale: 0, tEnd: 35 });
    assert.equal(ttx.spikeCount, 0, 'Na+ kanalı bloke edildiğinde aksiyon potansiyeli oluşmamalı');

    const fhn = simulateFHN({ I: 0.5, tEnd: 80 });
    assert.ok(Math.max(...fhn.v) > 1.0 && Math.min(...fhn.v) < -1.0);
  });
});

describe('3.4 Salgın Modelleri (SIR/SEIR)', () => {
  test('Nüfus korunumu, sürü bağışıklığı eşiği ve Kermack-McKendrick son büyüklük', () => {
    const sir = simulateEpidemic({ model: 'SIR', beta: 0.3, gamma: 0.1, I0: 0.001, tEnd: 250 });
    approx(sir.R0, 3.0, 1e-9);
    approx(sir.herdThreshold, 2 / 3, 1e-9);
    for (let i = 0; i < sir.t.length; i++) {
      approx(sir.S[i] + sir.E[i] + sir.I[i] + sir.R[i], 1.0, 1e-10);
    }
    // Kermack-McKendrick final size relation: S_inf = S0 * exp(-R0 * (1 - S_inf))
    const kmRHS = 0.999 * Math.exp(-3.0 * (1 - sir.finalS));
    approx(sir.finalS, kmRHS, 1e-3);

    // Above herd immunity (vaccFrac = 0.72 > 2/3): infected monotonically decreases
    const herd = simulateEpidemic({ model: 'SIR', beta: 0.3, gamma: 0.1, vaccFrac: 0.72, I0: 0.01, tEnd: 100 });
    assert.ok(herd.peakI <= 0.01001, 'Sürü bağışıklığı üstünde salgın büyümemeli');
  });
});

describe('3.5 Kardiyovasküler (Windkessel & Poiseuille)', () => {
  test('Windkessel fizyolojik basınç tepkisi ve Poiseuille r⁴ daralma yasası', () => {
    const wk = simulateWindkessel({ elements: 3, R: 1.0, C: 1.5, Zc: 0.06, hr: 72, strokeVolMl: 70 });
    assert.ok(wk.Psystolic > wk.Pdiastolic && wk.Pdiastolic > 40 && wk.Psystolic < 180);
    const stiff = simulateWindkessel({ elements: 3, R: 1.0, C: 0.6, Zc: 0.06, hr: 72, strokeVolMl: 70 });
    assert.ok(stiff.pulsePressure > wk.pulsePressure, 'Düşük kompliyans nabız basıncını artırmalı');

    const pFull = solvePoiseuilleStenosis({ radiusMm: 2, stenosisPct: 50, stenLenFrac: 1.0 });
    approx(pFull.flowRatio, 1 / 16, 1e-9, '%50 tam uzunluk daralma akışı 16 kat düşürmeli');
  });
});

describe('3.6 Biyomekanik & Kas', () => {
  test('Hill kuvvet-hız hiperbolü ve dirsek statik tork dengesi', () => {
    const F0 = 1000, vmax = 3, aRatio = 0.25;
    const a = aRatio * F0, b = aRatio * vmax;
    for (const v of [0, 0.5, 1.0, 2.0, 3.0]) {
      const { F } = hillForceVelocity({ F0, vmax, aRatio, v });
      approx((F + a) * (v + b), (F0 + a) * b, 1e-6, 'Hill hiperbol özdeşliği');
    }
    const hc = hillCurve({ F0, vmax, aRatio });
    assert.ok(hc.vOpt > 0.2 * vmax && hc.vOpt < 0.45 * vmax);
    approx(muscleForceLength(1.0).active, 1.0, 1e-9);

    const el = solveElbowBiomechanics({ thetaDeg: 90, loadKg: 5, forearmKg: 1.8 });
    assert.ok(el.Fbiceps > 5 * 9.81 * 5, 'Mekanik dezavantaj nedeniyle biseps kuvveti yükten çok büyük olmalı');
    approx(el.Fbiceps * el.momentArm, el.totalTorque, 1e-6);
  });
});

describe('3.7 Tıbbi Görüntüleme (CT FBP & Ultrason)', () => {
  test('Ram-Lak filtreli FBP, filtresiz geri projeksiyondan düşük RMSE verir; ultrason yankı zamanı', () => {
    const size = 32;
    const ph = createPhantom('dots', size);
    const { sinogram, numAngles, numDet } = computeSinogram(ph, size, 36);
    const fbp = reconstructFBP(sinogram, numAngles, numDet, size, { filtered: true, reference: ph });
    const raw = reconstructFBP(sinogram, numAngles, numDet, size, { filtered: false, reference: ph });
    assert.ok(fbp.rmse < raw.rmse, `FBP RMSE (${fbp.rmse}) < filtresiz (${raw.rmse}) olmalı`);

    const us = simulateUltrasound([
      { name: 'Yağ', thicknessMm: 14.5, c_ms: 1450, rho_kgm3: 950, atten_dBcmMHz: 0.6 },
      { name: 'Kas', thicknessMm: 30, c_ms: 1580, rho_kgm3: 1070, atten_dBcmMHz: 1.2 },
    ], 3.5);
    // t = 2 * 0.0145 / 1450 = 20 µs exact!
    approx(us.echoes[0].timeUs, 20.0, 1e-6);
    const Z1 = 950 * 1450, Z2 = 1070 * 1580;
    approx(us.echoes[0].reflCoeff, ((Z2 - Z1) / (Z2 + Z1)) ** 2, 1e-8);
  });
});

// =====================================================================
// FIELD 4: FİZİK & MATEMATİK (9 SIMULATIONS)
// =====================================================================

describe('4.1 Dalgalar & Girişim', () => {
  test('Doppler, Mach konisi, duran dalga harmonikleri ve vuru frekansı', () => {
    const d1 = dopplerMetrics({ f0: 440, c: 340, vs: 68, vo: 0 });
    approx(d1.fApproach, 440 * (340 / 272), 1e-6);
    approx(d1.fRecede, 440 * (340 / 408), 1e-6);
    const sup = dopplerMetrics({ f0: 440, c: 340, vs: 680, vo: 0 });
    approx(sup.machAngleDeg, 30, 1e-6); // sin(30) = 1/2

    const sw = standingWaveMetrics({ n: 3, L: 1.5, T: 36, mu: 0.004 });
    approx(sw.v, Math.sqrt(36 / 0.004), 1e-8);
    approx(sw.lambda, 1.0, 1e-8);
    approx(sw.freq, 3 * sw.v / 3, 1e-8);

    const b = beatsTrace({ f1: 10, f2: 12.5 });
    approx(b.fBeat, 2.5, 1e-9);
    const rip = rippleAmplitude({ s1: [-1, 0], s2: [1, 0], lambda: 1, dphi: 0, phaseT: 0, x: 0, y: 0 });
    approx(rip.pathDiff, 0, 1e-9);
  });
});

describe('4.2 Optik & Kırınım', () => {
  test('İnce mercek 2f kuralı, Snell/TIR, prizma dispersiyonu ve kırınım sıfırı', () => {
    const lens = solveThinOptics({ kind: 'convex-lens', fAbs: 15, do_: 30, ho: 6 });
    approx(lens.di, 30, 1e-8);
    approx(lens.m, -1, 1e-8);
    assert.equal(lens.real, true);
    assert.equal(lens.inverted, true);

    const sn = solveSnell({ n1: 1.5, n2: 1.0, thetaDeg: 45 });
    assert.equal(sn.tir, true);
    approx(sn.criticalDeg, (Math.asin(1 / 1.5) * 180) / Math.PI, 1e-6);

    const red = solvePrismRay({ apexDeg: 60, thetaInDeg: 48, lambdaNm: 660, glass: 'flint' });
    const vio = solvePrismRay({ apexDeg: 60, thetaInDeg: 48, lambdaNm: 420, glass: 'flint' });
    assert.ok(vio.deviationDeg > red.deviationDeg, 'Mor ışık kırmızıdan daha fazla sapmalı');

    const diff = diffractionPattern({ mode: 'single', aUm: 10, lambdaNm: 500, maxAngleDeg: 6, samples: 201 });
    approx(diff.firstMinDeg, (Math.asin(0.5 / 10) * 180) / Math.PI, 1e-6);
  });
});

describe('4.3 Kaos & Dinamik Sistemler', () => {
  test('Çift sarkaç enerji korunumu, lojistik Lyapunov üssü ve 2B doğrusal sınıflandırma', () => {
    let st = [1.2, 0, 1.8, 0];
    const p = { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 };
    const E0 = doublePendulumEnergy(st, p).E;
    for (let i = 0; i < 400; i++) st = doublePendulumStep(st, p, 0.005);
    const E1 = doublePendulumEnergy(st, p).E;
    approx(E1, E0, 1e-4, 'Çift sarkaç enerjisi RK4 ile korunmalı');

    assert.ok(logisticLyapunov(3.2) < 0, 'r=3.2 periyodik bölgede λ < 0');
    approx(logisticLyapunov(4.0, 4000), Math.LN2, 0.02, 'r=4.0 için λ = ln(2)');

    assert.ok(classifyLinear2D(1, 0, 0, -2).type.includes('Eyer'));
    assert.ok(classifyLinear2D(0, -1, 1, 0).type.includes('Merkez'));
    assert.ok(classifyLinear2D(-1, -2, 2, -1).type.includes('Kararlı Sarmal'));
    assert.ok(classifyLinear2D(-2, 0, 0, -3).type.includes('Kararlı Düğüm'));
  });
});

describe('4.4 Sayısal Yöntemler', () => {
  test('Kök bulma, Gauss-Legendre kesinliği, ODE mertebe sıralaması, Spline & EKK', () => {
    const p = ROOT_PRESETS.sqrt2;
    const rb = findRootBisection(p.f, p.a, p.b, 1e-8);
    const rn = findRootNewton(p.f, p.df, p.x0, 1e-10);
    const rs = findRootSecant(p.f, 1.0, 2.0, 1e-10);
    approx(rb.root, Math.SQRT2, 1e-7);
    approx(rn.root, Math.SQRT2, 1e-9);
    approx(rs.root, Math.SQRT2, 1e-9);
    assert.ok(rn.iters.length < rb.iters.length);

    // 3-point Gauss-Legendre integrates degree-5 polynomial exactly
    const poly5 = x => 6 * Math.pow(x, 5) - 3 * x * x + 1;
    // Integral from 0 to 2: [x^6 - x^3 + x]_0^2 = 64 - 8 + 2 = 58
    approx(integrateGaussLegendre(poly5, 0, 2, 3, 1), 58, 1e-11);
    approx(integrateSimpson(x => 4 * x * x * x, 0, 2, 4), 16, 1e-11);

    const ode = solveODECompare({ presetId: 'decay', h: 0.25 });
    assert.ok(ode.maxErr.rk4 < ode.maxErr.heun && ode.maxErr.heun < ode.maxErr.euler);

    const xs = [-1, -0.3, 0.4, 1.0];
    const ys = xs.map(x => Math.sin(2 * x));
    const sp = buildCubicSpline(xs, ys);
    for (let i = 0; i < xs.length; i++) approx(evalCubicSpline(sp, xs[i]), ys[i], 1e-12);
    for (let i = 0; i < xs.length; i++) approx(evalLagrange(xs, ys, xs[i]), ys[i], 1e-12);

    const qx = [-2, -1, 0, 1, 2, 3];
    const qy = qx.map(x => 3 * x * x - 2 * x + 5);
    const fit = polyLeastSquares(qx, qy, 2);
    approx(fit.coeffs[0], 5, 1e-9); approx(fit.coeffs[1], -2, 1e-9); approx(fit.coeffs[2], 3, 1e-9);
    approx(fit.r2, 1, 1e-9);
  });
});

describe('4.5 Kuantum Mekaniği', () => {
  test('Özfonksiyon normu, tünelleme T+R=1 & Ramsauer rezonansı, Hidrojen 1s zirvesi', () => {
    const sup = superpositionWave({ system: 'box', n1: 1, n2: 2, mix: 0.5, t: 1.7, L: 1, samples: 400 });
    approx(sup.norm, 1.0, 2e-3);
    const qho = superpositionWave({ system: 'qho', n1: 0, n2: 1, mix: 0.4, t: 2.3, samples: 400 });
    approx(qho.norm, 1.0, 2e-3);

    const tun = tunnelTransmission({ E: 3, V0: 6, a: 1.0 });
    approx(tun.T + tun.R, 1.0, 1e-12);
    assert.ok(tun.T > 0 && tun.T < 1);
    // Ramsauer-Townsend transmission resonance: k2 * a = pi => E - V0 = pi^2 / a^2
    const res = tunnelTransmission({ E: 6 + Math.PI * Math.PI, V0: 6, a: 1.0 });
    approx(res.T, 1.0, 1e-10);

    // Hydrogen 1s radial probability 4 r^2 e^(-2r) peaks at r = 1 a0 and integrates to 1
    let rInt = 0, dr = 0.05;
    for (let r = 0; r < 25; r += dr) rInt += hydrogenRadialProb(1, 0, r + 0.5 * dr) * dr;
    approx(rInt, 1.0, 5e-3);
    assert.ok(hydrogenRadialProb(1, 0, 1.0) > hydrogenRadialProb(1, 0, 0.7));
    assert.ok(hydrogenRadialProb(1, 0, 1.0) > hydrogenRadialProb(1, 0, 1.4));
    assert.ok(hydrogenWaveDensity(2, 1, 0, 0, 2) > hydrogenWaveDensity(2, 1, 0, 2, 0)); // 2p_z along z-axis
  });
});

describe('4.6 Faraday İndüksiyonu & LC Salınımı', () => {
  test('Faraday simetrik geçişte net akı değişimi 0; kayıpsız LC enerji korunumu', () => {
    const far = simulateFaradayPass({ N: 100, speed: 0.5, span: 0.3, n: 400 });
    const dt = far.tEnd / 400;
    const emfIntegral = far.emf.reduce((s, v) => s + v * dt, 0);
    approx(emfIntegral, 0, 1e-4);
    assert.ok(far.maxEmf > 0);

    const lc = simulateLCEnergy({ L: 0.01, C: 100e-6, R: 0, V0: 10, cycles: 2, n: 400 });
    approx(lc.f0, 1 / (2 * Math.PI * Math.sqrt(0.01 * 100e-6)), 1e-9);
    for (let i = 0; i < lc.Utot.length; i++) {
      approx(lc.Utot[i], lc.U0, 1e-6, 'Kayıpsız LC toplam enerjisi korunmalı');
    }
  });
});

describe('4.7 Görelilik & Modern Fizik', () => {
  test('Lorentz faktörü, fotoelektrik eşik ve Compton dalga boyu kayması', () => {
    const rel = lorentzMetrics(0.6, 100, 10);
    approx(rel.gamma, 1.25, 1e-10);
    approx(rel.L, 80, 1e-9);
    approx(rel.dt, 12.5, 1e-9);

    const peNo = solvePhotoelectric({ lambdaNm: 650, phiEv: 2.36 });
    assert.equal(peNo.emitted, false);
    const peYes = solvePhotoelectric({ lambdaNm: 300, phiEv: 2.36 });
    assert.equal(peYes.emitted, true);
    approx(peYes.kMaxEv, HC_EV_NM / 300 - 2.36, 1e-8);

    const c90 = solveCompton({ lambdaPm: 5.0, thetaDeg: 90 });
    approx(c90.deltaLambdaPm, COMPTON_PM, 1e-8);
    const c180 = solveCompton({ lambdaPm: 5.0, thetaDeg: 180 });
    approx(c180.deltaLambdaPm, 2 * COMPTON_PM, 1e-8);
    approx(c90.E_keV, c90.Eout_keV + c90.Te_keV, 1e-8, 'Enerji korunumu');
  });
});

describe('4.8 Vektör Analizi & Yüzey (Güvenli Ayrıştırıcı)', () => {
  test('İfade ayrıştırıcı, diverjans/rotasyonel ve Green Teoremi çizgi integrali', () => {
    const c1 = compileExpr2D('2x^2 - 3*sin(y) + pi');
    assert.equal(c1.ok, true);
    approx(c1.fn(2, Math.PI / 2), 8 - 3 + Math.PI, 1e-9);
    assert.equal(compileExpr2D('window.alert(1)').ok, false);

    const fx = (_x, y) => -y, fy = (x, _y) => x;
    const vf = evalVectorField2D(fx, fy, 1.2, -0.7);
    approx(vf.div, 0, 1e-6);
    approx(vf.curl, 2, 1e-6);

    // Line integral of (-y, x) around CCW unit circle = 2*pi (Green's Theorem: area pi * curl 2)
    const circle = Array.from({ length: 401 }, (_, i) => {
      const th = (2 * Math.PI * i) / 400;
      return [Math.cos(th), Math.sin(th)];
    });
    const li = computeLineIntegral2D(fx, fy, circle);
    approx(li.work, 2 * Math.PI, 2e-3);

    const gr = surfaceGradient((x, y) => x * x - y * y, 1.5, -2.0);
    approx(gr.gx, 3.0, 1e-6); approx(gr.gy, 4.0, 1e-6);
  });
});

describe('4.9 Olasılık Geometrisi (Buffon, Rastgele Yürüyüş, Galton)', () => {
  test('Buffon olasılığı, Galton Binom PMF ve difüzyon MSD ölçeklenmesi', () => {
    approx(buffonExactProb(1, 1), 2 / Math.PI, 1e-10);
    approx(buffonExactProb(0.5, 1), 1 / Math.PI, 1e-10);
    assert.ok(buffonExactProb(2, 1) > 2 / Math.PI && buffonExactProb(2, 1) < 1);
    const bf = buffonDropBatch({ L: 0.8, d: 1.0, count: 4000, seed: 42 });
    approx(bf.piEst, Math.PI, 0.15);

    const pmf = galtonBinomialPMF(12, 0.5);
    approx(pmf.reduce((s, v) => s + v, 0), 1, 1e-9);
    const gb = galtonDropBatch({ rows: 12, p: 0.5, count: 2000, seed: 7 });
    approx(gb.mean, 6.0, 0.15);

    const rw = createRandomWalkEnsemble({ dim: 2, count: 500, stepLen: 1, seed: 19 });
    let last;
    for (let t = 0; t < 40; t++) last = stepRandomWalkEnsemble(rw);
    relApprox(last.msd, 40, 0.15, '2B difüzyon <r^2> ≈ N l^2');
  });
});

// =====================================================================
// 5. UI MODULE CONTRACT & FULL 32-SIMULATION MOUNT/CLEANUP SMOKE TEST
// =====================================================================

describe('5. simlab-comp.js Modül Sözleşmesi ve Tüm 32 Simülasyon Mount Testi', () => {
  test('SIMS sözleşmesi: 32 simülasyon (8 bilgisayar, 8 endustri, 7 biyomed, 9 fizikmat), geçerli ikon/başlık, ham $...$ yok, mount & cleanup', async () => {
    const validIcons = new Set([
      'home', 'book', 'review', 'tool', 'settings', 'plus', 'pen', 'marker', 'eraser', 'select',
      'line', 'arrow', 'rect', 'ellipse', 'text', 'image', 'undo', 'redo', 'trash', 'download',
      'upload', 'fit', 'calc', 'back', 'check', 'play', 'pause', 'clock', 'sigma', 'x', 'dots',
      'search', 'flame', 'chart', 'grid', 'wave', 'resistor', 'matrix', 'phasor', 'edit', 'side',
      'star', 'install', 'sparkle', 'rotate', 'atom',
    ]);
    const validFields = new Set(['bilgisayar', 'endustri', 'biyomed', 'fizikmat']);

    const prev = {
      window: globalThis.window,
      document: globalThis.document,
      matchMedia: globalThis.matchMedia,
      addEventListener: globalThis.addEventListener,
      removeEventListener: globalThis.removeEventListener,
      dispatchEvent: globalThis.dispatchEvent,
      getComputedStyle: globalThis.getComputedStyle,
      devicePixelRatio: globalThis.devicePixelRatio,
      requestAnimationFrame: globalThis.requestAnimationFrame,
      cancelAnimationFrame: globalThis.cancelAnimationFrame,
      setTimeout: globalThis.setTimeout,
    };

    const timers = [];
    try {
      const noop = () => {};
      const fakeC2d = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'canvas') return {};
          if (prop === 'measureText') return () => ({ width: 20 });
          return noop;
        },
      });

      const makeFakeNode = (tagName = 'div', attrs = {}) => {
        const children = [];
        const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
        let rawHtml = '';
        const node = {
          tagName: tagName.toUpperCase(),
          attrs: { ...attrs },
          dataset: {},
          style: { setProperty: noop },
          hidden: false,
          checked: 'checked' in attrs,
          value: attrs.value ?? '0',
          textContent: '',
          clientWidth: 420,
          clientHeight: 280,
          width: 420,
          height: 280,
          parentElement: null,
          children,
          classList: {
            add: (...cs) => cs.forEach(c => classes.add(c)),
            remove: (...cs) => cs.forEach(c => classes.delete(c)),
            toggle: (c, f) => { if (f === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); } else if (f) classes.add(c); else classes.delete(c); },
            contains: c => classes.has(c),
          },
          get className() { return [...classes].join(' '); },
          set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
          addEventListener: noop,
          removeEventListener: noop,
          setAttribute: noop,
          getAttribute: () => null,
          setPointerCapture: noop,
          offsetWidth: 48,
          offsetHeight: 32,
          offsetLeft: 0,
          offsetTop: 0,
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 280 }),
          getContext: () => fakeC2d,
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
              if (last.startsWith('.')) { if (classes.has(last.slice(1))) return true; continue; }
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
            rawHtml = String(html ?? '');
            children.length = 0;
            // Verify NO raw $...$ TeX leaked into rendered HTML!
            assert.equal(/\$[^$\n<>]{2,}\$/.test(rawHtml), false, `Ham $...$ TeX bulundu: ${rawHtml.slice(0, 180)}`);
            const tagRe = /<(div|span|button|input|select|canvas|tbody|table|details|label|p|h4|tr)\b([^>]*)>/gi;
            let m;
            while ((m = tagRe.exec(rawHtml))) {
              const tName = m[1].toLowerCase();
              const a = {};
              const ds = {};
              for (const am of m[2].matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/gi)) {
                const key = am[1].toLowerCase();
                const val = am[2] ?? '';
                a[key] = val;
                if (key.startsWith('data-')) ds[key.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = val;
              }
              const child = makeFakeNode(tName, a);
              child.dataset = ds;
              child.parentElement = node;
              children.push(child);
            }
          },
          get innerHTML() { return rawHtml; },
        };
        for (const [k, v] of Object.entries(attrs)) {
          if (k.startsWith('data-')) node.dataset[k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = v;
        }
        return node;
      };

      globalThis.setTimeout = (fn, ms) => { const h = prev.setTimeout(fn, ms); timers.push(h); return h; };
      globalThis.devicePixelRatio = 1;
      globalThis.requestAnimationFrame = () => 1;
      globalThis.cancelAnimationFrame = noop;
      globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
      globalThis.addEventListener = noop;
      globalThis.removeEventListener = noop;
      globalThis.dispatchEvent = noop;
      globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#60a5fa' });
      const docEl = makeFakeNode('html');
      docEl.dataset.motion = 'reduced';
      globalThis.document = {
        hidden: false,
        hasFocus: () => true,
        documentElement: docEl,
        body: makeFakeNode('body'),
        head: makeFakeNode('head'),
        addEventListener: noop,
        removeEventListener: noop,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: tag => makeFakeNode(tag),
      };
      globalThis.window = globalThis;

      const { SIMS } = await import('../js/simlab-comp.js');
      assert.equal(SIMS.length, 32, 'Tam 32 simülasyon dışa aktarılmalı');

      const seenIds = new Set();
      const fieldCounts = { bilgisayar: 0, endustri: 0, biyomed: 0, fizikmat: 0 };
      for (const s of SIMS) {
        assert.ok(/^[a-z0-9-]+$/.test(s.id), `Geçersiz kebab id: ${s.id}`);
        assert.equal(seenIds.has(s.id), false, `Yinelenen id: ${s.id}`);
        seenIds.add(s.id);
        assert.ok(validFields.has(s.field), `Geçersiz alan: ${s.field}`);
        fieldCounts[s.field]++;
        assert.ok(validIcons.has(s.icon), `Geçersiz ikon: ${s.icon} (${s.id})`);
        assert.ok(s.title.length >= 4 && s.title.length <= 24, `Başlık uzunluğu uygun değil: "${s.title}"`);
        assert.equal(typeof s.mount, 'function');

        const host = makeFakeNode('div');
        const cleanFns = [];
        const ctx = { clean: { add: fn => typeof fn === 'function' && cleanFns.push(fn) } };
        const ret = s.mount(host, ctx);
        assert.equal(typeof ret, 'function', `${s.id} temizlik fonksiyonu döndürmeli`);
        ret();
        cleanFns.forEach(fn => fn());
      }
      assert.deepEqual(fieldCounts, { bilgisayar: 8, endustri: 8, biyomed: 7, fizikmat: 9 });
    } finally {
      for (const h of timers) clearTimeout(h);
      globalThis.window = prev.window;
      globalThis.document = prev.document;
      globalThis.matchMedia = prev.matchMedia;
      globalThis.addEventListener = prev.addEventListener;
      globalThis.removeEventListener = prev.removeEventListener;
      globalThis.dispatchEvent = prev.dispatchEvent;
      globalThis.getComputedStyle = prev.getComputedStyle;
      globalThis.devicePixelRatio = prev.devicePixelRatio;
      globalThis.requestAnimationFrame = prev.requestAnimationFrame;
      globalThis.cancelAnimationFrame = prev.cancelAnimationFrame;
      globalThis.setTimeout = prev.setTimeout;
    }
  });
});
