// MathPad Group Theory Center — Part C Tabs Module (Physics & Exceptional Structures)
// Covers Pierre Ramond's "Group Theory: A Physicist's Survey" Chapters 1, 4, 5.5, 6.7.1–6.7.3, 11, 12.
// Exports TABS array matching the exact center interface (all usesGroup: false).

import { FIZIK_LESSONS, UZAYZAMAN_LESSONS, OZEL_LESSONS } from './phys-lessons.js';
import { makeLessonsTab, makeQuizTab } from './phys-ui.js';
import {
  mountHilbertFermi,
  mountHarmonicSU3,
  mountBohrSO4,
  mountIsospinModels,
} from './phys-tabs-fizik.js';
import {
  mountLorentzPoincare,
  mountConformal,
  mountColorQuark,
  mountGaugeSM,
  mountGUT,
  mountFamilySym,
} from './phys-tabs-uzayzaman.js';
import {
  mountSymmetryGallery,
  mountHurwitz,
  mountMagicSquare,
} from './phys-tabs-ozel.js';

export const TABS = [
  // Chapter: fizik (Hilbert Spaces & Physics Applications — Ramond Ch. 4, 5.5, 6.7.1–6.7.3)
  { id: 'hilbert-fermi', chapter: 'fizik', title: 'Hilbert & Fermi Osilatörleri', icon: 'matrix', usesGroup: false, mount: mountHilbertFermi },
  { id: 'harmonik-su3', chapter: 'fizik', title: 'Harmonik Osilatör & SU(3)', icon: 'atom', usesGroup: false, mount: mountHarmonicSU3 },
  { id: 'bohr-so4', chapter: 'fizik', title: 'Bohr Atomu & SO(4)', icon: 'ellipse', usesGroup: false, mount: mountBohrSO4 },
  { id: 'izospin-cekirdek', chapter: 'fizik', title: 'İzospin & Çekirdek Modelleri', icon: 'sigma', usesGroup: false, mount: mountIsospinModels },
  { id: 'fizik-konu', chapter: 'fizik', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(FIZIK_LESSONS, 'Hilbert Uzayları & Fizik Uygulamaları (Ramond Böl. 4, 5.5, 6.7)') },
  { id: 'fizik-alistirma', chapter: 'fizik', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'fizik', storeKey: 'mp.physQuiz.fizik', chapterLabel: 'Fizik Uygulamaları' }) },

  // Chapter: uzayzaman (Space-Time & Standard Model — Ramond Ch. 11)
  { id: 'lorentz-poincare', chapter: 'uzayzaman', title: 'Lorentz & Poincaré Grupları', icon: 'phasor', usesGroup: false, mount: mountLorentzPoincare },
  { id: 'konformal-grup', chapter: 'uzayzaman', title: 'Konformal Grup', icon: 'grid', usesGroup: false, mount: mountConformal },
  { id: 'renk-kuark', chapter: 'uzayzaman', title: 'Renk & Kuark Modeli', icon: 'sparkle', usesGroup: false, mount: mountColorQuark },
  { id: 'standart-model', chapter: 'uzayzaman', title: 'Ayar Teorileri & Standart Model', icon: 'calc', usesGroup: false, mount: mountGaugeSM },
  { id: 'buyuk-birlesme', chapter: 'uzayzaman', title: 'Büyük Birleşme (GUT)', icon: 'side', usesGroup: false, mount: mountGUT },
  { id: 'aile-simetrileri', chapter: 'uzayzaman', title: 'Aile Simetrileri', icon: 'wave', usesGroup: false, mount: mountFamilySym },
  { id: 'uzayzaman-konu', chapter: 'uzayzaman', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(UZAYZAMAN_LESSONS, 'Uzay-Zaman & Standart Model Grupları (Ramond Böl. 11)') },
  { id: 'uzayzaman-alistirma', chapter: 'uzayzaman', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'uzayzaman', storeKey: 'mp.physQuiz.uzayzaman', chapterLabel: 'Uzay-Zaman & SM' }) },

  // Chapter: ozel (Preface & Exceptional Structures — Ramond Ch. 1, 12)
  { id: 'simetri-galerisi', chapter: 'ozel', title: 'Simetri Galerisi', icon: 'rotate', usesGroup: false, mount: mountSymmetryGallery },
  { id: 'hurwitz-cebirleri', chapter: 'ozel', title: 'Hurwitz Cebirleri', icon: 'flame', usesGroup: false, mount: mountHurwitz },
  { id: 'sihirli-kare', chapter: 'ozel', title: 'Sihirli Kare', icon: 'chart', usesGroup: false, mount: mountMagicSquare },
  { id: 'ozel-konu', chapter: 'ozel', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(OZEL_LESSONS, 'Önsöz & İstisnai Cebirsel Yapılar (Ramond Böl. 1, 12)') },
  { id: 'ozel-alistirma', chapter: 'ozel', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'ozel', storeKey: 'mp.physQuiz.ozel', chapterLabel: 'Özel Yapılar' }) },
];
