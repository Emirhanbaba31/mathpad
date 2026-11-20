// MathPad Group Theory Center — Part B Tabs Module (Lie Groups & Lie Algebras)
// Covers Pierre Ramond's "Group Theory: A Physicist's Survey" Chapters 4.3 (oscillators), 5, 6, 7, 8, 10, Appendix 2.
// Exports TABS array matching the exact center interface.

import { SU2_LESSONS, SU3_LESSONS, LIE_LESSONS, OTESI_LESSONS } from './lie-lessons.js';
import { makeLessonsTab, makeQuizTab } from './lie-ui.js';
import {
  mountSU2Lab,
  mountSU2toSU11,
  mountSU3Lab,
  mountWeightDiagrams,
  mountEightfoldWay,
} from './lie-tabs-su.js';
import {
  mountDynkinClassification,
  mountRootExplorer,
  mountWeylGroup,
  mountRepCalculator,
  mountTensorProducts,
  mountYoungSUN,
} from './lie-tabs-class.js';
import {
  mountSpinorClifford,
  mountEmbeddingsGUT,
  mountVermaWeyl,
  mountLieAppendix,
  mountKacMoodySuper,
} from './lie-tabs-adv.js';

const SU2_QUIZ_TOPICS = [
  ['su2', 'Karışık (tüm SU(2) & SU(1,1) konuları)'],
  ['su2_dim_casimir', 'Spin boyutu & Casimir J²'],
  ['su2_tensor', 'Açısal momentum toplamı j₁ ⊗ j₂'],
  ['su2_cg', 'Clebsch-Gordan katsayıları'],
  ['su11_casimir', 'SU(1,1) ayrık seri Casimir Q'],
  ['bohr_so4', 'Bohr atomu SO(4) dejenereliği'],
  ['ALL', 'Tüm Lie bölümlerinden karışık'],
];

const SU3_QUIZ_TOPICS = [
  ['su3', 'Karışık (tüm SU(3) konuları)'],
  ['su3_dim', 'SU(3) (p,q) temsil boyutu'],
  ['su3_i3y', 'Dynkin ağırlığı → (I₃, Y)'],
  ['su3_tensor', 'SU(3) tensör çarpımları'],
  ['su3_eightfold', 'Sekizli Yol & Gell-Mann–Nishijima'],
  ['su3_ho', '3B izotropik harmonik salınıcı'],
  ['ALL', 'Tüm Lie bölümlerinden karışık'],
];

const LIE_QUIZ_TOPICS_LIST = [
  ['lie', 'Karışık (tüm sınıflandırma & temsil konuları)'],
  ['lie_alg_dim', 'Basit Lie cebiri boyutu'],
  ['lie_weyl_order', 'Weyl grubu mertebesi |W|'],
  ['lie_pos_roots', 'Pozitif kök sayısı |Δ⁺|'],
  ['lie_rep_dim', 'Weyl boyut formülü (SO(10), E₆, E₇, E₈, G₂…)'],
  ['lie_young_hook', 'SU(N) Young kanca-içerik formülü'],
  ['lie_spinor', 'SO(d) spinör boyutu'],
  ['lie_branching', 'GUT dallanma kuralları'],
  ['ALL', 'Tüm Lie bölümlerinden karışık'],
];

const OTESI_QUIZ_TOPICS = [
  ['otesi', 'Karışık (Serre, Kac-Moody, Süper cebirler)'],
  ['otesi_serre', 'Serre bağıntısı üssü'],
  ['otesi_sugawara', 'Sugawara Virasoro merkezi yükü c'],
  ['otesi_affine_h', 'İkili Coxeter sayısı h∨'],
  ['otesi_super', 'Lie süper cebiri fermiyonik boyutu'],
  ['ALL', 'Tüm Lie bölümlerinden karışık'],
];

export const TABS = [
  // Chapter: su2 (Ramond Ch. 5 + 4.3 SU(2)/SU(1,1))
  { id: 'su2-lab', chapter: 'su2', title: 'SU(2) Laboratuvarı', icon: 'rotate', usesGroup: false, mount: mountSU2Lab },
  { id: 'su2-su11', chapter: 'su2', title: 'SU(2) → SU(1,1)', icon: 'wave', usesGroup: false, mount: mountSU2toSU11 },
  { id: 'su2-konu', chapter: 'su2', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(SU2_LESSONS, 'SU(2), SU(1,1) ve Salınıcı Cebirleri (Ramond Böl. 4.3, 5)') },
  { id: 'su2-alistirma', chapter: 'su2', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'su2', storeKey: 'mp.lieQuiz.su2', topics: SU2_QUIZ_TOPICS }) },

  // Chapter: su3 (Ramond Ch. 6)
  { id: 'su3-lab', chapter: 'su3', title: 'SU(3) Laboratuvarı', icon: 'matrix', usesGroup: false, mount: mountSU3Lab },
  { id: 'agirlik-diyagram', chapter: 'su3', title: 'Ağırlık Diyagramları', icon: 'atom', usesGroup: false, mount: mountWeightDiagrams },
  { id: 'sekizli-yol', chapter: 'su3', title: 'Sekizli Yol', icon: 'sparkle', usesGroup: false, mount: mountEightfoldWay },
  { id: 'su3-konu', chapter: 'su3', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(SU3_LESSONS, 'SU(3) Cebiri, Bazlar, Elliott ve Sekizli Yol (Ramond Böl. 6)') },
  { id: 'su3-alistirma', chapter: 'su3', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'su3', storeKey: 'mp.lieQuiz.su3', topics: SU3_QUIZ_TOPICS }) },

  // Chapter: lie (Ramond Ch. 7, 8 & Appendix 2)
  { id: 'dynkin-sinif', chapter: 'lie', title: 'Dynkin & Sınıflandırma', icon: 'grid', usesGroup: false, mount: mountDynkinClassification },
  { id: 'kok-sistemi', chapter: 'lie', title: 'Kök Sistemi Gezgini', icon: 'phasor', usesGroup: false, mount: mountRootExplorer },
  { id: 'weyl-grubu', chapter: 'lie', title: 'Weyl Grubu', icon: 'rotate', usesGroup: false, mount: mountWeylGroup },
  { id: 'temsil-hesap', chapter: 'lie', title: 'Temsil Hesaplayıcısı', icon: 'calc', usesGroup: false, mount: mountRepCalculator },
  { id: 'tensor-carpim', chapter: 'lie', title: 'Tensör Çarpımları', icon: 'x', usesGroup: false, mount: mountTensorProducts },
  { id: 'young-sun', chapter: 'lie', title: 'Young Tabloları (SU(N))', icon: 'rect', usesGroup: false, mount: mountYoungSUN },
  { id: 'spinor-clifford', chapter: 'lie', title: 'Spinörler & Clifford', icon: 'ellipse', usesGroup: false, mount: mountSpinorClifford },
  { id: 'gomme-gut', chapter: 'lie', title: 'Gömmeler & GUT', icon: 'side', usesGroup: false, mount: mountEmbeddingsGUT },
  { id: 'verma-weyl', chapter: 'lie', title: 'Verma & Weyl Formülü', icon: 'chart', usesGroup: false, mount: mountVermaWeyl },
  { id: 'lie-ekler', chapter: 'lie', title: 'Lie Cebiri Ekleri (Ek 2)', icon: 'dots', usesGroup: false, mount: mountLieAppendix },
  { id: 'lie-konu', chapter: 'lie', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(LIE_LESSONS, 'Basit Lie Cebirleri, Sınıflandırma ve Temsil Teorisi (Ramond Böl. 7, 8, Ek 2)') },
  { id: 'lie-alistirma', chapter: 'lie', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'lie', storeKey: 'mp.lieQuiz.lie', topics: LIE_QUIZ_TOPICS_LIST }) },

  // Chapter: otesi (Ramond Ch. 10)
  { id: 'kac-moody-super', chapter: 'otesi', title: 'Kac-Moody & Süper Cebirler', icon: 'flame', usesGroup: false, mount: mountKacMoodySuper },
  { id: 'otesi-konu', chapter: 'otesi', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(OTESI_LESSONS, 'Lie Cebirlerinin Ötesi: Serre, Afin Kac-Moody & Süper Cebirler (Ramond Böl. 10)') },
  { id: 'otesi-alistirma', chapter: 'otesi', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'otesi', storeKey: 'mp.lieQuiz.otesi', topics: OTESI_QUIZ_TOPICS }) },
];
