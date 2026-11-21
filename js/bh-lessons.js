// MathPad Kara Delik Konu Anlatımı (Part 4 of 4)
// Saf ES modülü (DOM yok, ui.js / fx.js / phys-ui.js bağımlılığı yok; node testlerinde doğrudan çalışır).
// Her dersin çözümlü örneği doğrudan Part 1'deki js/bh-core.js fonksiyonlarıyla hesaplanır.

import * as BH from './bh-core.js';

// =====================================================================
// 1. ÖRNEK HESAPLAMALARI (TAMAMEN js/bh-core.js ÜZERİNDEN)
// =====================================================================

const fmtN = (x, d = 2) => BH.formatNumTR(x, d);
const fmtS = (x, d = 2) => BH.formatSciTR(x, d);
const fmtTexSci = (x, d = 2) => {
  if (!Number.isFinite(x)) return '\\infty';
  if (x === 0) return '0';
  const [m, e] = Math.abs(x).toExponential(d).split('e');
  const exp = parseInt(e, 10);
  const sgn = x < 0 ? '-' : '';
  return `${sgn}${m.replace('.', ',')} \\times 10^{${exp}}`;
};

const CAT = Object.fromEntries(BH.BH_CATALOG.map(o => [o.id, o]));

// Ders 1: Dünya, Güneş ve insan için r_s ile ortalama yoğunluk
const ex1EarthRsMm = BH.schwarzschildRadius(BH.M_EARTH) * 1e3;
const ex1SunRsKm = BH.mToKm(BH.schwarzschildRadius(BH.M_SUN));
const ex1PersonRsM = BH.schwarzschildRadius(70);
const ex1SunRho = BH.blackHoleMeanDensity(BH.M_SUN);
const ex1M87MassKg = BH.solarMassToKg(CAT['m87-star'].massSolar);
const ex1M87Rho = BH.blackHoleMeanDensity(ex1M87MassKg);

// Ders 2: 10 M☉ Schwarzschild geometrisi
const ex2MassKg = BH.solarMassToKg(10);
const ex2RgKm = BH.mToKm(BH.gravRadius(ex2MassKg));
const ex2RsKm = BH.mToKm(BH.schwarzschildRadius(ex2MassKg));
const ex2Kappa = BH.surfaceGravity(ex2MassKg);
const ex2Vesc4RsOverC = BH.escapeVelocity(ex2MassKg, 4 * BH.schwarzschildRadius(ex2MassKg)) / BH.C;

// Ders 3: Sgr A* foton küresi, gölge yarıçapı b_c ve Güneş kenarında sapma
const ex3SgrKg = BH.solarMassToKg(CAT['sgr-a'].massSolar);
const ex3SgrRsKm = BH.mToKm(BH.schwarzschildRadius(ex3SgrKg));
const ex3SgrRphKm = BH.mToKm(BH.photonSphereRadius(ex3SgrKg));
const ex3SgrBcKm = BH.mToKm(BH.shadowRadius(ex3SgrKg));
const ex3SunDefArcsec = BH.radToArcsec(BH.lightDeflectionSI(BH.M_SUN, BH.R_SUN));
const ex3StrongB6Deg = (BH.lightDeflectionAngle(6) * 180) / Math.PI;

// Ders 4: 10 M☉ X-ışını ikilisi vs 10^8 M☉ kuasar ince diski
const ex4M10Kg = BH.solarMassToKg(10);
const ex4M10IscoKm = BH.mToKm(BH.schwarzschildIsco(ex4M10Kg));
const ex4Eta0 = BH.kerrRadiativeEfficiency(0);
const ex4Ledd10 = BH.eddingtonLuminosity(ex4M10Kg);
const ex4Mdot10 = 0.1 * BH.eddingtonAccretionRate(ex4M10Kg, ex4Eta0);
const ex4Disk10 = BH.diskTemperatureMax(ex4M10Kg, ex4Mdot10, BH.schwarzschildIsco(ex4M10Kg));
const ex4M8Kg = BH.solarMassToKg(1e8);
const ex4Mdot8 = 0.1 * BH.eddingtonAccretionRate(ex4M8Kg, ex4Eta0);
const ex4Disk8 = BH.diskTemperatureMax(ex4M8Kg, ex4Mdot8, BH.schwarzschildIsco(ex4M8Kg));

// Ders 5: Zaman genişlemesi ve Hα kırmızıya kayması
const ex5M10Kg = BH.solarMassToKg(10);
const ex5Rs10 = BH.schwarzschildRadius(ex5M10Kg);
const ex5Dil2Rs = BH.staticTimeDilation(ex5M10Kg, 2 * ex5Rs10);
const ex5OnePlusZ2Rs = BH.gravitationalRedshiftFactor(ex5M10Kg, 2 * ex5Rs10);
const ex5Z2Rs = BH.gravitationalRedshift(ex5M10Kg, 2 * ex5Rs10);
const ex5HalphaObsNm = 656.3 * ex5OnePlusZ2Rs;
const ex5IscoVOverC = BH.circularOrbitSpeed(ex5M10Kg, BH.schwarzschildIsco(ex5M10Kg)) / BH.C;
const ex5IscoDil = BH.circularOrbitTimeDilation(ex5M10Kg, BH.schwarzschildIsco(ex5M10Kg));

// Ders 6: Gelgit kuvveti ve spagettileşme (10 M☉ vs Sgr A*)
const ex6Tidal10 = BH.spaghettificationAnalysis(BH.solarMassToKg(10), { bodyLengthM: 2, limitG: 10 });
const ex6TidalSgr = BH.spaghettificationAnalysis(ex3SgrKg, { bodyLengthM: 2, limitG: 10 });

// Ders 7: Radyal serbest düşüş (Sgr A*, r0 = 5 r_s)
const ex7SgrRs = BH.schwarzschildRadius(ex3SgrKg);
const ex7FallH = BH.radialFreeFall(ex3SgrKg, 5 * ex7SgrRs, ex7SgrRs);
const ex7Fall105 = BH.radialFreeFall(ex3SgrKg, 5 * ex7SgrRs, 1.05 * ex7SgrRs);
const ex7MaxInt = BH.maxInteriorFallTime(ex3SgrKg);

// Ders 8: Kerr kara deliği — Cygnus X-1 (21,2 M☉, a* = 0,998)
const ex8CygKg = BH.solarMassToKg(CAT['cygnus-x1'].massSolar);
const ex8CygSpin = CAT['cygnus-x1'].spin;
const ex8Kerr = BH.kerrSummary(ex8CygKg, ex8CygSpin);
const ex8ExtrSolar = BH.kgToSolarMass(ex8Kerr.extractableMassKg);

// Ders 9: Hawking ışıması ve termodinamik (1 M☉ ve ilkel kara delik)
const ex9SunHawk = BH.hawkingSummary(BH.M_SUN);
const ex9PrimMassKg = BH.evaporationMassForTime(BH.AGE_OF_UNIVERSE);
const ex9PrimTempK = BH.hawkingTemperature(ex9PrimMassKg);
const ex9PrimRsM = BH.schwarzschildRadius(ex9PrimMassKg);

// Ders 10: Kütleçekim dalgaları — GW150914 (36 + 29 M☉, 410 Mpc)
const ex10Gw = BH.GW_PRESETS.find(p => p.id === 'GW150914');
const ex10M1 = BH.solarMassToKg(ex10Gw.m1Solar);
const ex10M2 = BH.solarMassToKg(ex10Gw.m2Solar);
const ex10DistM = BH.mpcToM(ex10Gw.distanceMpc);
const ex10McSol = BH.kgToSolarMass(BH.chirpMass(ex10M1, ex10M2));
const ex10FIsco = BH.gwIscoFrequency(ex10M1 + ex10M2);
const ex10Rem = BH.gwRemnantProperties(ex10M1, ex10M2);
const ex10RadSol = BH.kgToSolarMass(ex10Rem.radiatedMassKg);
const ex10FinSol = BH.kgToSolarMass(ex10Rem.finalMassKg);
const ex10FQnm = BH.gwQnmFrequency(ex10Rem.finalMassKg, ex10Rem.finalSpin);
const ex10Strain = BH.gwStrainAmplitude(BH.chirpMass(ex10M1, ex10M2), ex10FIsco, ex10DistM);

// Ders 11: EHT görüntüleme — M87* (2019) ve Sgr A* (2022)
const ex11M87Uas = BH.radToUas(BH.shadowAngularDiameter(ex1M87MassKg, BH.pcToM(CAT['m87-star'].distancePc)));
const ex11SgrUas = BH.radToUas(BH.shadowAngularDiameter(ex3SgrKg, BH.pcToM(CAT['sgr-a'].distancePc)));
const ex11SgrPerMin = BH.circularOrbitPeriod(ex3SgrKg, BH.schwarzschildIsco(ex3SgrKg)).coordPeriod / 60;
const ex11M87PerDays = BH.circularOrbitPeriod(ex1M87MassKg, BH.schwarzschildIsco(ex1M87MassKg)).coordPeriod / 86400;

// Ders 12: Oluşum kanalları — GW190521, TON 618 ve ilkel kara delik
const ex12ImbhRsKm = BH.mToKm(BH.schwarzschildRadius(BH.solarMassToKg(CAT['gw190521'].massSolar)));
const ex12TonMassKg = BH.solarMassToKg(CAT['ton-618'].massSolar);
const ex12TonRsAU = BH.schwarzschildRadius(ex12TonMassKg) / BH.AU;
const ex12TonRsKm = BH.mToKm(BH.schwarzschildRadius(ex12TonMassKg));

// Ders 13: Gözlemsel kanıtlar — S2 yıldızı (enberi ≈ 120 AU) ve Cygnus X-1
const ex13S2PeriM = 120 * BH.AU;
const ex13S2PeriOverRs = ex13S2PeriM / ex7SgrRs;
const ex13S2GravZ = BH.gravitationalRedshift(ex3SgrKg, ex13S2PeriM);
const ex13S2GravKmS = (ex13S2GravZ * BH.C) / 1e3;
const ex13S2PrecArcmin = BH.radToArcsec(BH.periapsisPrecessionSI(ex3SgrKg, 970 * BH.AU, 0.8846)) / 60;
const ex13CygRsKm = BH.mToKm(BH.schwarzschildRadius(ex8CygKg));
const ex13CygIscoKm = BH.mToKm(ex8Kerr.iscoPrograde);

// =====================================================================
// 2. 13 BÖLÜMLÜK TÜRKÇE KARA DELİK KONU ANLATIMI (BH_LESSONS)
// =====================================================================

export const BH_LESSONS = Object.freeze([
  // -------------------------------------------------------------------
  // DERS 1
  // -------------------------------------------------------------------
  {
    id: 'kara-delik-nedir',
    number: 1,
    title: 'Kara Delik Nedir? Kaçış Hızı, Michell–Laplace ve Schwarzschild (1916)',
    shortTitle: 'Kara Delik Nedir?',
    readingMinutes: 4,
    body: [
      'Bir gök cisminin yüzeyinden sonsuza kaçabilmek için gereken en küçük hız **kaçış hızı** olarak tanımlanır: $v_{\\text{kaç}} = \\sqrt{2GM/R}$. Kütle sabit kalırken yarıçap küçüldükçe kaçış hızı artar. 1783\'te John Michell ve 1796\'da Pierre-Simon Laplace, Newton mekaniği çerçevesinde ışığı parçacık gibi düşünerek kaçış hızının ışık hızına ($c$) eşit olduğu **karanlık yıldız** kavramını ortaya attılar.',
      'Newtoncu yaklaşımla elde edilen kritik yarıçap $R = 2GM/c^2$, şaşırtıcı biçimde genel görelilikteki kesin **Schwarzschild yarıçapı** $r_s$ ile aynı cebirsel ifadeyi verir. Ancak fiziksel yorum tamamen farklıdır: Newton uzayında ışık önce yükselip sonra geri düşebilirken, Einstein\'ın genel göreliliğinde (1915) kütleçekim bir kuvvet değil, **uzay-zamanın eğriliğidir**.',
      'Karl Schwarzschild, Einstein\'ın alan denklemlerini yayımlanmasından yalnızca haftalar sonra, 1916\'da küresel simetrik vakum için kesin olarak çözdü. Bu çözümde $r = r_s$ yüzeyi, gelecekteki tüm ışık ışınlarını içeriye büken tek yönlü bir nedensel sınır — yani **olay ufku** — oluşturur. Bir kara delik dışarıdan bakıldığında "yüzeyi olan katı bir top" değil, içine giren bilgi ve ışığın bir daha dışarı çıkamadığı bir uzay-zaman bölgesidir.',
    ],
    equations: [
      { label: 'Kaçış hızı ve Schwarzschild yarıçapı', tex: 'v_{\\text{kaç}} = \\sqrt{\\frac{2GM}{r}}, \\qquad r_s = \\frac{2GM}{c^2}' },
      { label: 'Olay ufku içi ortalama yoğunluk', tex: '\\bar{\\rho} = \\frac{M}{\\frac{4}{3}\\pi r_s^3} = \\frac{3c^6}{32\\pi G^3 M^2} \\propto M^{-2}' },
    ],
    example: {
      title: 'Çözümlü Örnek: Dünya, Güneş ve Dev Kara Deliklerde Olay Ufku Ölçeği',
      problem: 'Dünya ($M_\\oplus$), Güneş ($M_\\odot$) ve $70\\,\\text{kg}$\'lık bir insanın Schwarzschild yarıçaplarını hesaplayın; $1\\,M_\\odot$ ile M87* ($6,5\\times 10^9\\,M_\\odot$) için ortalama yoğunlukları karşılaştırın.',
      steps: [
        `Dünya ($M_\\oplus = ${fmtTexSci(BH.M_EARTH, 3)}\\,\\text{kg}$) için $r_s = \\frac{2GM_\\oplus}{c^2} \\approx ${fmtN(ex1EarthRsMm, 2)}\\,\\text{mm}$ — bir misket büyüklüğünde!`,
        `Güneş ($M_\\odot = ${fmtTexSci(BH.M_SUN, 3)}\\,\\text{kg}$) için $r_s \\approx ${fmtN(ex1SunRsKm, 2)}\\,\\text{km}$ (gerçek yarıçapının yaklaşık $235\\,000$\'de biri).`,
        `$70\\,\\text{kg}$ kütle için $r_s \\approx ${fmtTexSci(ex1PersonRsM, 2)}\\,\\text{m}$ — bir protonun yarıçapından yaklaşık $10$ milyar kat küçük.`,
        `Ortalama yoğunluk $M^{-2}$ ile azaldığından $1\\,M_\\odot$ kara delik için $\\bar{\\rho} \\approx ${fmtTexSci(ex1SunRho, 2)}\\,\\text{kg/m}^3$ (atom çekirdeğinden yoğun), M87* için ise yalnızca $\\bar{\\rho} \\approx ${fmtTexSci(ex1M87Rho, 2)}\\,\\text{kg/m}^3$ — deniz seviyesindeki havadan bile seyrek!`,
      ],
      result: `Schwarzschild yarıçapı kütleyle doğrusal büyür ($r_s \\approx 2,95\\,(M/M_\\odot)\\,\\text{km}$), ortalama yoğunluk ise $M^{-2}$ ile hızla düşer.`,
    },
    summary: 'Kara delik, tüm kütlesi Schwarzschild yarıçapı $r_s = 2GM/c^2$ içine çökmüş ve çevresinde tek yönlü bir olay ufku oluşturan genel görelilik nesnesidir. Kütle büyüdükçe olay ufku genişler ve ortalama yoğunluk $\\bar{\\rho} \\propto M^{-2}$ olarak azalır.',
    actions: [
      { label: 'Gözlemevi\'nde gör (Sgr A*)', tab: 'gozlemevi', params: { preset: 'sgr-a' } },
      { label: 'Hesaplayıcı\'da dene', tab: 'hesaplayici', params: { mass: 1, unit: 'solar' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 2
  // -------------------------------------------------------------------
  {
    id: 'schwarzschild-metrigi',
    number: 2,
    title: 'Schwarzschild Metriği ve Olay Ufku',
    shortTitle: 'Schwarzschild Metriği',
    readingMinutes: 5,
    body: [
      'Dönmeyen, elektriksel olarak yüksüz ve küresel simetrik bir $M$ kütlesinin dışındaki vakum uzay-zamanın geometrisi **Schwarzschild metriği** ile tam olarak belirlenir. Birkhoff teoremine göre, küresel simetrik herhangi bir vakum çözümü zorunlu olarak durağandır ve Schwarzschild metriğine eşdeğerdir.',
      'Metrikte $r$ bir merkezden ölçülen Öklid mesafesi değil, çevresi $2\\pi r$ olan kürelerin **alan yarıçapı**dır. $r = r_s = 2GM/c^2$ konumunda $g_{tt} = -(1 - r_s/r)$ sıfırlanır ve $g_{rr} = (1 - r_s/r)^{-1}$ ıraksar. Ancak bu bir **koordinat tekilliğidir**, gerçek bir fiziksel tekillik değildir: Kretschmann skaları $K = R_{\\mu\\nu\\rho\\sigma}R^{\\mu\\nu\\rho\\sigma} = 48 G^2 M^2 / (c^4 r^6)$ olay ufkunda sonludur ve yalnızca $r = 0$\'da sonsuza gider.',
      'Olay ufkunun içinde ($r < r_s$) metrik katsayılarının işaretleri ters döner: $r$ koordinatı **zaman-benzeri** (timelike), $t$ koordinatı ise **uzay-benzeri** (spacelike) olur. Bu nedenle ufkun içinde $r$\'nin azalması zamanın ileri akması kadar kaçınılmazdır — $r = 0$ tekilliği uzayda bir yer değil, ufku geçen herkesin **geleceğindeki bir andır**.',
    ],
    equations: [
      { label: 'Schwarzschild çizgi elemanı', tex: 'ds^2 = -\\left(1 - \\frac{r_s}{r}\\right) c^2 dt^2 + \\left(1 - \\frac{r_s}{r}\\right)^{-1} dr^2 + r^2\\left(d\\theta^2 + \\sin^2\\theta\\, d\\phi^2\\right)' },
      { label: 'Kütleçekim yarıçapı ve yüzey kütleçekimi', tex: 'r_g = \\frac{GM}{c^2} = \\frac{r_s}{2}, \\qquad \\kappa = \\frac{c^4}{4GM} = \\frac{c^2}{2r_s}' },
    ],
    example: {
      title: 'Çözümlü Örnek: 10 M☉ Kara Delikte Geometrik Ölçek ve Yüzey Kütleçekimi',
      problem: 'Kütlesi $M = 10\\,M_\\odot$ olan bir Schwarzschild kara deliği için $r_g$, $r_s$, yüzey kütleçekimi $\\kappa$ ve $r = 4r_s$ konumundaki yerel kaçış hızını hesaplayın.',
      steps: [
        `Geometrik uzunluk birimi $r_g = GM/c^2 \\approx ${fmtN(ex2RgKm, 2)}\\,\\text{km}$ ve olay ufku $r_s = 2r_g \\approx ${fmtN(ex2RsKm, 2)}\\,\\text{km}$.`,
        `Yüzey kütleçekimi $\\kappa = \\frac{c^4}{4GM} \\approx ${fmtTexSci(ex2Kappa, 2)}\\,\\text{m/s}^2$ ($\\approx ${fmtTexSci(ex2Kappa / BH.G0, 2)}\\,g_0$).`,
        `$r = 4r_s$ konumunda yerel statik gözlemcinin ölçtüğü kaçış hızı $v_{\\text{kaç}} = c\\sqrt{r_s/r} = c\\sqrt{1/4} = ${fmtN(ex2Vesc4RsOverC, 2)}\\,c$.`,
      ],
      result: `$r_s \\approx ${fmtN(ex2RsKm, 2)}\\,\\text{km}$, $\\kappa \\approx ${fmtTexSci(ex2Kappa, 2)}\\,\\text{m/s}^2$ ve $r = 4r_s$\'de $v_{\\text{kaç}} = 0,50\\,c$.`,
    },
    summary: 'Schwarzschild metriğinde $r = r_s$ gerçek bir eğrilik tekilliği değil, nedensel bir tek yönlü zar (olay ufku) oluşturan koordinat tekilliğidir. Ufuk içinde $r$ zaman-benzeri hale gelir ve tüm gelecek dünya çizgileri $r = 0$ tekilliğinde sonlanır.',
    actions: [
      { label: 'Simülasyonu aç: Etkin Potansiyel', tab: 'simulasyonlar', params: { sim: 'bh-potential' } },
      { label: 'Hesaplayıcı\'da incele', tab: 'hesaplayici', params: { mass: 10, unit: 'solar' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 3
  // -------------------------------------------------------------------
  {
    id: 'foton-kuresi-ve-golge',
    number: 3,
    title: 'Foton Küresi, Kütleçekimsel Merceklenme ve Kara Delik Gölgesi',
    shortTitle: 'Foton Küresi & Gölge',
    readingMinutes: 5,
    body: [
      'Işık kütleçekim alanında **sıfır jeodezikler** ($ds^2 = 0$) boyunca yol alır. Schwarzschild geometrisinde ekvatoryal bir ışık ışınının yörüngesi $u = 1/r$ değişkeni cinsinden $d^2u/d\\phi^2 + u = 3(GM/c^2)u^2$ denklemini sağlar. Sağ taraftaki $3Mu^2$ terimi Newton fiziğinde yoktur; güçlü alanda ışığı olağanüstü derecede bükerek kara delik çevresinde döngü yapmasına yol açar.',
      'Işık için etkin potansiyel $V_{\\text{null}}(r) = (1 - 2M/r)/r^2$ tam olarak $r_{\\text{ph}} = 3GM/c^2 = 1,5\\,r_s$ konumunda bir tepe yapar. Bu yüzey **foton küresi**dir: burada ışık kararsız dairesel yörüngede dönebilir. Tepe yüksekliği $1/(27 M^2)$ olduğundan, çarpışma parametresi $b < b_c = 3\\sqrt{3}\\,GM/c^2 \\approx 5,196\\,M$ olan her foton bariyeri aşarak olay ufkuna düşer.',
      'Uzak bir gözlemci kara deliğe baktığında karanlık bölgenin kenarı $r_s = 2M$ değil, merceklenme yüzünden $b_c = 3\\sqrt{3}\\,M \\approx 2,60\\,r_s$ yarıçaplı **kara delik gölgesi** olarak görünür. $b \\to b_c^+$ limitindeki fotonlar kara delik etrafında yarım, bir veya daha fazla tur sararak gölge sınırında son derece keskin ve parlak bir **foton halkası** oluştururlar. Zayıf alanda ($b \\gg r_s$) sapma açısı Einstein\'ın ünlü $\\Delta\\phi = 4GM/(c^2 b)$ formülüne indirgenir ve tam bir hizalanmada arka plan kaynağı bir **Einstein halkası**na dönüşür.',
    ],
    equations: [
      { label: 'Foton küresi ve gölge yarıçapı (kritik çarpışma parametresi)', tex: 'r_{\\text{ph}} = \\frac{3GM}{c^2} = 1,5\\,r_s, \\qquad b_c = 3\\sqrt{3}\\,\\frac{GM}{c^2} \\approx 2,598\\,r_s' },
      { label: 'Zayıf alan ışık sapması ve sıfır jeodezik denklemi', tex: '\\Delta\\phi_{\\text{zayıf}} = \\frac{4GM}{c^2 b}, \\qquad \\frac{d^2 u}{d\\phi^2} + u = 3\\,\\frac{GM}{c^2}\\,u^2' },
    ],
    example: {
      title: 'Çözümlü Örnek: Sgr A* Foton Küresi, Gölge Boyutu ve Güneş Kenarı Sapması',
      problem: 'Sgr A* ($M = 4,15\\times 10^6\\,M_\\odot$) için $r_s$, $r_{\\text{ph}}$ ve gölge yarıçapı $b_c$\'yi bulun; ayrıca Güneş kenarından teğet geçen ışığın sapmasını ve $b = 6M$\'deki güçlü alan sapmasını karşılaştırın.',
      steps: [
        `Sgr A* için $r_s \\approx ${fmtTexSci(ex3SgrRsKm, 2)}\\,\\text{km}$, foton küresi $r_{\\text{ph}} = 1,5\\,r_s \\approx ${fmtTexSci(ex3SgrRphKm, 2)}\\,\\text{km}$.`,
        `Gölge yarıçapı $b_c = 3\\sqrt{3}\\,r_g \\approx ${fmtTexSci(ex3SgrBcKm, 2)}\\,\\text{km}$ (olay ufkunun $2,60$ katı).`,
        `Güneş kenarında ($b = R_\\odot$) zayıf alan sapması $\\Delta\\phi = 4GM_\\odot/(c^2 R_\\odot) \\approx ${fmtN(ex3SunDefArcsec, 3)}''$ (1919 Eddington tutulma gözlemiyle doğrulandı).`,
        `Güçlü alanda $b = 6M$ için tam jeodezik integrasyonu $\\Delta\\phi \\approx ${fmtN(ex3StrongB6Deg, 1)}^\\circ$ verir — zayıf alan tahmininin ($38,2^\\circ$) çok üstünde!`,
      ],
      result: `Sgr A* gölge yarıçapı $b_c \\approx ${fmtTexSci(ex3SgrBcKm, 2)}\\,\\text{km}$; Güneş kenarı sapması $${fmtN(ex3SunDefArcsec, 3)}''$.`,
    },
    summary: 'Foton küresi ($r_{\\text{ph}} = 3M$) kararsız dairesel ışık yörüngelerinin yeridir. Güçlü merceklenme nedeniyle kara deliğin görünen karanlık gölgesi $b_c = 3\\sqrt{3}\\,M \\approx 2,60\\,r_s$ yarıçaplıdır ve çevresi parlak bir foton halkasıyla kuşatılır.',
    actions: [
      { label: 'Simülasyonu aç: Işığın Bükülmesi', tab: 'simulasyonlar', params: { sim: 'bh-light' } },
      { label: 'Gözlemevi\'nde gör: Merceklenme', tab: 'gozlemevi', params: { preset: 'merceklenme' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 4
  // -------------------------------------------------------------------
  {
    id: 'isco-ve-yigilma-diski',
    number: 4,
    title: 'ISCO ve Yığılma Diskleri',
    shortTitle: 'ISCO & Yığılma Diski',
    readingMinutes: 6,
    body: [
      'Newton kütleçekiminde herhangi bir yarıçapta kararlı dairesel yörünge kurulabilir; çünkü merkezkaç bariyeri $+L^2/(2r^2)$ her zaman $-GM/r$ çekimini küçük yarıçaplarda yener. Genel görelilikte ise etkin potansiyele gelen **$-2M L^2/r^3$** terimi çok küçük yarıçaplarda merkezkaç bariyerini devirir.',
      'Sonuç olarak dönmeyen bir kara delikte kararlı dairesel yörüngeler yalnızca $r \\ge r_{\\text{ISCO}} = 6GM/c^2 = 3\\,r_s$ için vardır (**En İçteki Kararlı Dairesel Yörünge — ISCO**). $L < 2\\sqrt{3}\\,M$ açısal momentumunda potansiyel kuyusu tamamen kaybolur ve madde doğrudan olay ufkuna dalar. ISCO\'ya kadar yavaşça sarmal çizen gaz, durgun kütle enerjisinin $\\eta = 1 - \\sqrt{8/9} \\approx \\%5,72$\'sini ışınım olarak serbest bırakır — bu, yıldızlardaki hidrojen füzyonunun ($\\approx \\%0,7$) sekiz katından fazladır!',
      '**Shakura–Sunyaev ince yığılma diski** modelinde viskoz sürtünme açısal momentumu dışa taşırken gazı içe indirir ve diski ısıtır. Yerel sıcaklık profili $T(r) \\propto r^{-3/4}(1 - \\sqrt{r_{\\text{in}}/r})^{1/4}$ biçimindedir ve $r_{\\text{tepe}} = (49/36)\\,r_{\\text{in}}$ konumunda tepe yapar. Parlaklığın üst sınırı, ışınım basıncının kütleçekimi dengelediği **Eddington parlaklığı** $L_{\\text{Edd}}$ ile belirlenir. Sabit Eddington oranında $T_{\\text{maks}} \\propto M^{-1/4}$ olduğundan yıldızsal kara deliklerin diskleri milyonlarca kelvinde **X-ışını**, süperkütleli kuasar diskleri ise daha serin olup **morötesi ve görünür** ışık yayar.',
    ],
    equations: [
      { label: 'Kütleli parçacık etkin potansiyeli ve ISCO (M = 1)', tex: 'V_{\\text{eff}}(r) = \\left(1 - \\frac{2}{r}\\right)\\left(1 + \\frac{L^2}{r^2}\\right), \\qquad r_{\\text{ISCO}} = \\frac{6GM}{c^2}' },
      { label: 'Shakura–Sunyaev sıcaklık profili ve Eddington parlaklığı', tex: 'T(r) = \\left[\\frac{3GM\\dot{M}}{8\\pi\\sigma_{\\text{SB}} r^3}\\left(1 - \\sqrt{\\frac{r_{\\text{in}}}{r}}\\right)\\right]^{1/4}, \\qquad L_{\\text{Edd}} = \\frac{4\\pi G M m_p c}{\\sigma_T}' },
    ],
    example: {
      title: 'Çözümlü Örnek: Yıldızsal X-Işını İkilisi ile Süperkütleli Kuasar Diskinin Karşılaştırılması',
      problem: 'Aynı $f_{\\text{Edd}} = 0,10$ beslenme oranında çalışan $10\\,M_\\odot$ ve $10^8\\,M_\\odot$ dönmeyen iki kara deliğin ISCO yarıçapını, Eddington parlaklığını ve azami disk sıcaklıklarını kıyaslayın.',
      steps: [
        `$10\\,M_\\odot$ için $r_{\\text{ISCO}} \\approx ${fmtN(ex4M10IscoKm, 1)}\\,\\text{km}$, $L_{\\text{Edd}} \\approx ${fmtTexSci(ex4Ledd10, 2)}\\,\\text{W}$ ve $\\eta = 1 - \\sqrt{8/9} \\approx \\%${fmtN(ex4Eta0 * 100, 2)}$.`,
        `$10\\,M_\\odot$ diskinin tepe sıcaklığı $T_{\\text{maks}} \\approx ${fmtTexSci(ex4Disk10.Tmax, 2)}\\,\\text{K}$ (${ex4Disk10.band} bölgesi).`,
        `$10^8\\,M_\\odot$ kuasar diskinde kütle $10^7$ kat büyük olduğundan $T_{\\text{maks}} \\propto M^{-1/4}$ yüzünden sıcaklık $10^{7/4} \\approx 56,2$ kat düşer: $T_{\\text{maks}} \\approx ${fmtTexSci(ex4Disk8.Tmax, 2)}\\,\\text{K}$ (${ex4Disk8.band} bölgesi).`,
      ],
      result: `Yıldızsal kara delik diski ($${fmtTexSci(ex4Disk10.Tmax, 2)}\\,\\text{K}$, ${ex4Disk10.band}) süperkütleli kuasar diskinden ($${fmtTexSci(ex4Disk8.Tmax, 2)}\\,\\text{K}$, ${ex4Disk8.band}) çok daha sıcaktır!`,
    },
    summary: 'Schwarzschild kara deliğinde kararlı dairesel yörüngeler $r_{\\text{ISCO}} = 6M$\'de biter. Yığılma diskleri kütleçekim enerjisini yüksek verimle ışınıma çevirir; $T_{\\text{maks}} \\propto M^{-1/4}$ ölçeklemesi yüzünden küçük kara delikler X-ışınında, dev kuasarlar ise UV/görünür ışıkta parlar.',
    actions: [
      { label: 'Simülasyonu aç: Yığılma Diski', tab: 'simulasyonlar', params: { sim: 'bh-accretion' } },
      { label: 'Simülasyonu aç: Göreli Yörüngeler', tab: 'simulasyonlar', params: { sim: 'bh-orbits' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 5
  // -------------------------------------------------------------------
  {
    id: 'kirmiziya-kayma-ve-zaman-genislemesi',
    number: 5,
    title: 'Kütleçekimsel Kırmızıya Kayma ve Zaman Genişlemesi',
    shortTitle: 'Zaman & Kırmızı Kayma',
    readingMinutes: 5,
    body: [
      'Schwarzschild metriğinde sabit $(r, \\theta, \\phi)$ konumunda duran (statik) bir gözlemcinin kendi kol saatinde geçen **öz zaman** $d\\tau$, sonsuzdaki gözlemcinin koordinat zamanı $dt$ ile $d\\tau = \\sqrt{1 - r_s/r}\\,dt$ bağıntısıyla ilişkilidir. Kütleçekim kuyusunun derinliklerine inildikçe saatler dışarıya kıyasla yavaşlar ve $r \\to r_s^+$ limitinde $d\\tau/dt \\to 0$ olur.',
      'Aynı etki elektromanyetik dalgaların frekansını da değiştirir: derin bir kütleçekim kuyusundan tırmanan fotonlar enerji kaybederek daha uzun dalga boylarına kayarlar (**kütleçekimsel kırmızıya kayma**). Statik kaynaktan uzaktaki gözlemciye ulaşan ışık için $1 + z = \\lambda_{\\text{göz}}/\\lambda_0 = (1 - r_s/r)^{-1/2}$ geçerlidir. Bu olay ufkuna yaklaşan bir kaynağın tayfını kızılötesine ve radyoya iter, bolometrik yüzey parlaklığını ise $(1+z)^{-4}$ ile hızla söndürür.',
      'Serbest dairesel yörüngedeki bir saatte hem kütleçekimsel yavaşlama hem de özel görelilik hız yavaşlaması birlikte çalışır: $d\\tau/dt = \\sqrt{1 - 3GM/(c^2 r)}$. Dönen bir yığılma diskinde buna bir de göreli **Doppler ışınlaması** eklenir: gözlemciye yaklaşan disk kenarı maviye kayar ve $g^4$ çarpanıyla çok daha parlak görünürken, uzaklaşan kenar kırmızıya kayar ve sönükleşir.',
    ],
    equations: [
      { label: 'Statik zaman genişlemesi ve kütleçekimsel kırmızıya kayma', tex: '\\frac{d\\tau}{dt} = \\sqrt{1 - \\frac{r_s}{r}}, \\qquad 1 + z = \\frac{\\lambda_{\\text{göz}}}{\\lambda_0} = \\frac{1}{\\sqrt{1 - r_s/r}}' },
      { label: 'Dairesel yörüngede saat hızı ve birleşik Doppler + GR kayması', tex: '\\left(\\frac{d\\tau}{dt}\\right)_{\\text{dair}} = \\sqrt{1 - \\frac{3GM}{c^2 r}}, \\qquad 1 + z = \\frac{1 - \\beta\\cos\\psi}{\\sqrt{1 - 3r_s/(2r)}}' },
    ],
    example: {
      title: 'Çözümlü Örnek: r = 2 rₛ\'de Hα Çizgisi ve ISCO\'daki Saat',
      problem: 'Bir Schwarzschild kara deliğinden $r = 2r_s$ uzaklıkta sabit duran bir sonda $\\text{H}\\alpha$ ($\\lambda_0 = 656,3\\,\\text{nm}$) ışığı yayıyor. Zaman genişlemesini, kırmızıya kaymayı, gözlenen dalga boyunu ve ISCO ($r = 3r_s$) yörüngesindeki hız ile saat oranını bulun.',
      steps: [
        `$r = 2r_s$ konumunda $d\\tau/dt = \\sqrt{1 - 1/2} = 1/\\sqrt{2} \\approx ${fmtN(ex5Dil2Rs, 4)}$ (dışarıda $1\\,\\text{saat}$ geçerken sondada $${fmtN(ex5Dil2Rs * 60, 1)}\\,\\text{dk}$ geçer).`,
        `$1 + z = \\sqrt{2} \\approx ${fmtN(ex5OnePlusZ2Rs, 4)} \\implies z \\approx ${fmtN(ex5Z2Rs, 4)}$.`,
        `Gözlenen dalga boyu $\\lambda_{\\text{göz}} = 656,3 \\times ${fmtN(ex5OnePlusZ2Rs, 4)} \\approx ${fmtN(ex5HalphaObsNm, 1)}\\,\\text{nm}$ — görünür kırmızı ışık artık **yakın kızılötesine** kaymıştır!`,
        `ISCO\'daki ($r = 6M$) dairesel yörüngede yerel hız $v = ${fmtN(ex5IscoVOverC, 2)}\\,c$ (ışık hızının yarısı!) ve saat oranı $d\\tau/dt = \\sqrt{1 - 3/6} = 1/\\sqrt{2} \\approx ${fmtN(ex5IscoDil, 4)}$ olur.`,
      ],
      result: `$r = 2r_s$\'de $z \\approx ${fmtN(ex5Z2Rs, 4)}$ ($\\text{H}\\alpha \\to ${fmtN(ex5HalphaObsNm, 1)}\\,\\text{nm}$); ISCO\'da $v = 0,50\\,c$ ve $d\\tau/dt \\approx ${fmtN(ex5IscoDil, 4)}$.`,
    },
    summary: 'Kütleçekim kuyusu derinleştikçe saatler $d\\tau/dt = \\sqrt{1 - r_s/r}$ ile yavaşlar ve fotonlar kırmızıya kayar. Dönen yığılma disklerinde bu etki göreli Doppler kaymasıyla birleşerek parlak yaklaşan ve sönük uzaklaşan asimetrik halka görünümünü yaratır.',
    actions: [
      { label: 'Simülasyonu aç: Zaman & Kırmızı Kayma', tab: 'simulasyonlar', params: { sim: 'bh-redshift' } },
      { label: 'Gözlemevi\'nde gör (Gargantua)', tab: 'gozlemevi', params: { preset: 'gargantua' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 6
  // -------------------------------------------------------------------
  {
    id: 'gelgit-ve-spagettilesme',
    number: 6,
    title: 'Gelgit Kuvvetleri ve Spagettileşme',
    shortTitle: 'Gelgit & Spagettileşme',
    readingMinutes: 4,
    body: [
      'Serbest düşüşteki bir astronot ağırlıksızlık hisseder — eşdeğerlik ilkesi gereği tekdüze bir kütleçekim alanı yerel olarak yok edilebilir. Ancak gerçek bir kara deliğin kütleçekim alanı tekdüze değildir: astronotun kara deliğe daha yakın olan ayakları başından daha güçlü çekilir. İki nokta arasındaki bu ivme farkı, genel görelilikte **Riemann eğrilik tensörünün** doğrudan fiziksel tezahürü olan **gelgit kuvveti**dir.',
      '$L$ uzunluğundaki bir cisim boyunca radyal gerilme ivmesi $\\Delta a_{\\text{rad}} = 2GML/r^3$, buna dik iki enine doğrultuda ise sıkıştırma ivmesi $\\Delta a_{\\text{enine}} = -GML/r^3$ olur (izsiz tensör: $+2 - 1 - 1 = 0$, yani ilk mertebede hacim korunur). Cismin uzun ince bir lif gibi gerilip sıkışmasına **spagettileşme** denir.',
      'En çarpıcı sonuç olay ufkundaki ($r = r_s = 2GM/c^2$) gelgit ivmesidir: $\\Delta a(r_s) = c^6 L / (4G^2 M^2) \\propto M^{-2}$. Kütle arttıkça ufuktaki eğrilik ve gelgit ivmesi **hızla küçülür**! Bu yüzden bir yıldızsal kara delikte astronot ufka ulaşmadan yüzlerce kilometre dışarıda parçalanırken, Sgr A* veya M87* gibi bir süperkütleli kara deliğin olay ufkundan neredeyse hiçbir şey hissetmeden geçebilir (tekilliğe yaklaştıkça parçalanma yine de kaçınılmazdır).',
    ],
    equations: [
      { label: 'Radyal gelgit ivmesi ve spagettileşme yarıçapı', tex: '\\Delta a = \\frac{2GML}{r^3}, \\qquad r_{\\text{gelgit}} = \\left(\\frac{2GML}{a_{\\text{maks}}}\\right)^{1/3}' },
      { label: 'Olay ufkunda gelgit ivmesi ve sağlam geçiş kütle eşiği', tex: '\\Delta a(r_s) = \\frac{c^6 L}{4G^2 M^2}, \\qquad M_{\\text{eşik}} = \\frac{c^3}{2G}\\sqrt{\\frac{L}{a_{\\text{maks}}}}' },
    ],
    example: {
      title: 'Çözümlü Örnek: 10 M☉ Yıldızsal Kara Delik ile Sgr A* Ufkunda Astronot',
      problem: 'Boyu $L = 2\\,\\text{m}$ ve dayanım sınırı $10\\,g_0$ olan bir astronot için $10\\,M_\\odot$ ve Sgr A* ($4,15\\times 10^6\\,M_\\odot$) olay ufuklarındaki gelgit ivmelerini ve eşik kütleyi karşılaştırın.',
      steps: [
        `$10\\,M_\\odot$ kara deliğin olay ufkunda ($r_s \\approx ${fmtN(BH.mToKm(ex6Tidal10.schwarzschildRadius), 1)}\\,\\text{km}$) gelgit ivmesi $\\Delta a(r_s) \\approx ${fmtTexSci(ex6Tidal10.horizonTidalG, 2)}\\,g_0$ — ölümcül! $10\\,g_0$ sınırına ufuktan çok uzakta, $r_{\\text{gelgit}} \\approx ${fmtN(BH.mToKm(ex6Tidal10.tidalRadius), 0)}\\,\\text{km} \\approx ${fmtN(ex6Tidal10.ratioToHorizon, 0)}\\,r_s$ konumunda ulaşılır.`,
        `Sgr A* olay ufkunda gelgit ivmesi yalnızca $\\Delta a(r_s) \\approx ${fmtTexSci(ex6TidalSgr.horizonTidalG, 2)}\\,g_0$ — tamamen fark edilmez; spagettileşme ufkun derinliklerinde ($r \\approx ${fmtN(ex6TidalSgr.ratioToHorizon, 3)}\\,r_s$) gerçekleşir.`,
        `Olay ufkunu $10\\,g_0$ sınırını aşmadan geçebilmek için gereken en küçük kütle $M_{\\text{eşik}} \\approx ${fmtTexSci(ex6Tidal10.thresholdMassSolar, 2)}\\,M_\\odot$.`,
      ],
      result: `$10\\,M_\\odot$ ufuk dışında ($${fmtN(ex6Tidal10.ratioToHorizon, 0)}\\,r_s$) parçalar; Sgr A* ufkunda gelgit yalnızca $${fmtTexSci(ex6TidalSgr.horizonTidalG, 2)}\\,g_0$\'dir.`,
    },
    summary: 'Gelgit kuvveti uzay-zaman eğriliğinin doğrudan ölçüsüdür ve olay ufkunda $\\Delta a(r_s) \\propto M^{-2}$ ile azalır. Yıldızsal kara delikler ufuk dışında spagettileştirirken, $M \\gtrsim 1,45\\times 10^4\\,M_\\odot$ üzerindeki dev kara deliklerin ufku sakin biçimde geçilebilir.',
    actions: [
      { label: 'Simülasyonu aç: Gelgit & Spagettileşme', tab: 'simulasyonlar', params: { sim: 'bh-tidal' } },
      { label: 'Hesaplayıcı\'da kıyasla', tab: 'hesaplayici', params: { mass: 4.15e6, unit: 'solar' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 7
  // -------------------------------------------------------------------
  {
    id: 'kara-delige-dusus-ve-penrose',
    number: 7,
    title: 'Kara Deliğe Düşüş: Öz Zaman, Koordinat Zamanı ve Penrose Diyagramı',
    shortTitle: 'Düşüş & Penrose Diyagramı',
    readingMinutes: 6,
    body: [
      'Bir astronot $r_0 > r_s$ noktasından serbest bırakılıp radyal olarak kara deliğe düşerken iki gözlemci tamamen farklı öyküler anlatır. Uzaktaki gözlemcinin Schwarzschild koordinat zamanında $t(r)$ olay ufkuna yaklaşırken logaritmik olarak sonsuza gider: dışarıdaki gözlemci astronotun ufukta yavaşlayıp donduğunu, ışığının hızla kırmızıya kayarak karanlığa gömüldüğünü görür.',
      'Buna karşılık astronotun kendi kol saatindeki **öz zaman** $\\tau(r)$ tam sikloid denklemiyle sonlu kalır! Astronot olay ufkunu sonlu bir öz sürede, yerel bir "duvar" görmeden geçer ve ardından tekilliğe ($r = 0$) doğru kaçınılmaz son yolculuğuna girer. Ufuk içinde roketleri ateşlemek bile durumu kurtaramaz — hatta en uzun olası iç yaşam süresi tam ufukta durgun bırakılan serbest düşüşe aittir: $\\tau_{\\text{maks}} = \\pi GM/c^3$.',
      'Bu küresel nedensel yapıyı tek bir sonlu haritada görmek için **Kruskal–Szekeres** koordinatları konformal olarak sıkıştırılarak **Penrose (Carter–Penrose) diyagramı** çizilir. Bu diyagramda tüm radyal ışık ışınları her yerde tam **$45^\\circ$** eğimle gider. Olay ufku $45^\\circ$\'lik bir çizgi, $r = 0$ tekilliği ise en üstte yatay bir sınır (uzay-benzeri bir gelecek anı) olarak görünür; ufkun içine (Bölge II) geçen her gözlemcinin gelecek ışık konisinin tamamı doğrudan tekilliğe çarpar.',
    ],
    equations: [
      { label: 'Radyal serbest düşüş sikloid çözümü', tex: 'r(\\eta) = \\frac{r_0}{2}(1 + \\cos\\eta), \\qquad \\tau(\\eta) = \\sqrt{\\frac{r_0^3}{8GM}}(\\eta + \\sin\\eta)' },
      { label: 'Olay ufkundan tekilliğe azami öz süre', tex: '\\tau_{\\text{maks}} = \\frac{\\pi GM}{c^3} \\approx 1,547\\times 10^{-5}\\left(\\frac{M}{M_\\odot}\\right)\\,\\text{s}' },
    ],
    example: {
      title: 'Çözümlü Örnek: Sgr A* Kara Deliğine r₀ = 5 rₛ\'den Serbest Düşüş',
      problem: 'Sgr A* ($M = 4,15\\times 10^6\\,M_\\odot$) çevresinde $r_0 = 5r_s$ konumunda serbest bırakılan bir kapsülün $r = 1,05r_s$\'de öz/koordinat zamanlarını, ufka varış süresini ve ufuktan tekilliğe geçiş süresini bulun.',
      steps: [
        `$r_1 = 1,05r_s$ konumuna ulaşıldığında kapsülün öz saati $\\tau \\approx ${fmtN(ex7Fall105.properTime, 1)}\\,\\text{s}$ gösterirken uzaktaki gözlemcinin koordinat saati $t \\approx ${fmtN(ex7Fall105.coordTime, 1)}\\,\\text{s}$ ($${fmtN(ex7Fall105.coordTime / ex7Fall105.properTime, 2)}$ katı) gösterir.`,
        `Olay ufkuna ($r = r_s$) geçiş kapsülün saatinde sonludur: $\\tau_H \\approx ${fmtN(ex7FallH.timeToHorizon, 1)}\\,\\text{s}$ (uzaktaki saatte $t \\to \\infty$).`,
        `Ufku geçtikten sonra tekilliğe yalnızca $\\tau_{H\\to 0} \\approx ${fmtN(ex7FallH.horizonToSingularity, 1)}\\,\\text{s}$ kalır (mutlak üst sınır $\\tau_{\\text{maks}} = \\pi GM/c^3 \\approx ${fmtN(ex7MaxInt, 1)}\\,\\text{s}$).`,
      ],
      result: `Sgr A* için $5r_s \\to r_s$ düşüşü $${fmtN(ex7FallH.timeToHorizon, 1)}\\,\\text{s}$, ufuktan tekilliğe düşüş ise yalnızca $${fmtN(ex7FallH.horizonToSingularity, 1)}\\,\\text{s}$ sürer.`,
    },
    summary: 'Olay ufku uzaktaki gözlemciye göre sonsuz koordinat zamanında erişilen donmuş bir sınır, düşen gözlemciye göre ise sonlu öz sürede geçilen sıradan bir eşiktir. Penrose diyagramında ışık konileri $45^\\circ$ kalır ve ufkun içindeki tüm gelecek yollar $r = 0$ tekilliğinde sonlanır.',
    actions: [
      { label: 'Simülasyonu aç: Penrose Diyagramı', tab: 'simulasyonlar', params: { sim: 'bh-penrose' } },
      { label: 'Simülasyonu aç: Zaman & Kırmızı Kayma', tab: 'simulasyonlar', params: { sim: 'bh-redshift' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 8
  // -------------------------------------------------------------------
  {
    id: 'kerr-donen-kara-delikler',
    number: 8,
    title: 'Dönen Kara Delikler: Kerr Metriği, Ergosfer ve Penrose Süreci',
    shortTitle: 'Kerr & Ergosfer',
    readingMinutes: 6,
    body: [
      'Gerçek astrofiziksel kara deliklerin hemen hepsi doğdukları yıldızların veya yığdıkları gazın açısal momentumunu koruyarak döner. Roy Kerr\'in 1963\'te bulduğu kesin vakum çözümü, bir kara deliğin dış geometrisini yalnızca iki parametreyle — kütle $M$ ve boyutsuz **spin parametresi** $a_* = cJ/(GM^2) \\in [-1, 1]$ — belirler (**Saçsızlık Teoremi**).',
      'Dönme, Schwarzschild yapısını derinden değiştirir: olay ufku $r_+ = M(1 + \\sqrt{1 - a_*^2})$ konumuna büzülür ve içerde ikinci bir Cauchy ufku $r_- = M(1 - \\sqrt{1 - a_*^2})$ ortaya çıkar. Ufkun dışında, ekvatorda $r_{\\text{ergo}} = 2M$ yarıçapına kadar uzanan **ergosfer** bölgesi yer alır. Ergosfer içinde **çerçeve sürüklenmesi** (Lense–Thirring etkisi) o kadar güçlüdür ki hiçbir cisim — ışık bile — uzak yıldızlara göre sabit duramaz; herkes kara delikle aynı yönde sürüklenmek zorundadır.',
      'Roger Penrose (1969), ergosfer içinde negatif enerjili yörüngelerin var olabildiğini göstererek **Penrose süreci**ni keşfetti: ergosferde ikiye bölünen bir parçacığın bir yarısı negatif enerjiyle kara deliğe düşerken, diğer yarısı başlangıçtakinden daha yüksek enerjiyle dışarı kaçar ve enerjiyi doğrudan kara deliğin dönmesinden çalar! Benzer biçimde manyetik alan çizgilerinin ergosferde bükülmesi (**Blandford–Znajek mekanizması**) kuasarların göreli jetlerini besler. Ayrıca eşyönlü (prograde) ISCO $a_* \\to 1$ iken $6M$\'den $1M$\'ye kadar yaklaşır ve ince disk ışınım verimi $\\%5,7$\'den $\\%42,3$\'e sıçrar.',
    ],
    equations: [
      { label: 'Kerr olay ufukları ve ergosfer dış sınırı (geometrik M = 1)', tex: 'r_\\pm = 1 \\pm \\sqrt{1 - a_*^2}, \\qquad r_{\\text{ergo}}(\\theta) = 1 + \\sqrt{1 - a_*^2\\cos^2\\theta}' },
      { label: 'Çerçeve sürüklenmesi, indirgenemez kütle ve disk verimi', tex: '\\Omega_H = \\frac{a_* c^3}{2GM r_+/M}, \\qquad M_{\\text{irr}} = M\\sqrt{\\frac{r_+}{2M}}, \\qquad \\eta = 1 - \\sqrt{1 - \\frac{2}{3\\,r_{\\text{ISCO}}/M}}' },
    ],
    example: {
      title: 'Çözümlü Örnek: Hızlı Dönen Cygnus X-1 (a* = 0,998)',
      problem: 'Cygnus X-1 ($M = 21,2\\,M_\\odot$, $a_* = 0,998$) için dış olay ufku $r_+$, eşyönlü ve ters yönlü ISCO yarıçapları, disk ışınım verimi $\\eta$ ve çıkarılabilir dönme enerjisini hesaplayın.',
      steps: [
        `Dış olay ufku $r_+ \\approx ${fmtN(ex8Kerr.rPlusGeom, 3)}\\,M \\approx ${fmtN(BH.mToKm(ex8Kerr.rPlus), 1)}\\,\\text{km}$ (dönmeyen ufuk $2M \\approx ${fmtN(ex13CygRsKm, 1)}\\,\\text{km}$\'nin neredeyse yarısı). Ekvatoryal ergosfer $r_+$\'dan $2M$\'ye kadar uzanır.`,
        `Bardeen–Press–Teukolsky formülüyle eşyönlü ISCO $r_{\\text{ISCO},+} \\approx ${fmtN(ex8Kerr.iscoProgradeGeom, 3)}\\,M$ ($${fmtN(BH.mToKm(ex8Kerr.iscoPrograde), 1)}\\,\\text{km}$), ters yönlü ISCO ise $r_{\\text{ISCO},-} \\approx ${fmtN(ex8Kerr.iscoRetrogradeGeom, 3)}\\,M$ bulunur.`,
        `Eşyönlü disk ışınım verimi $\\eta_+ \\approx \\%${fmtN(ex8Kerr.efficiencyPrograde * 100, 1)}$ — Schwarzschild\'in $\\%5,72$ veriminin neredeyse $6$ katı!`,
        `Christodoulou–Ruffini formülüne göre toplam kütle-enerjinin $\\%${fmtN(ex8Kerr.extractableFraction * 100, 1)}$\'i ($\\approx ${fmtN(ex8ExtrSolar, 2)}\\,M_\\odot c^2$) kuramsal olarak dönme enerjisi biçiminde çıkarılabilir.`,
      ],
      result: `Cygnus X-1\'de $r_+ \\approx ${fmtN(ex8Kerr.rPlusGeom, 3)}\\,M$, $r_{\\text{ISCO},+} \\approx ${fmtN(ex8Kerr.iscoProgradeGeom, 3)}\\,M$, $\\eta_+ \\approx \\%${fmtN(ex8Kerr.efficiencyPrograde * 100, 1)}$ ve çıkarılabilir enerji $${fmtN(ex8ExtrSolar, 2)}\\,M_\\odot c^2$.`,
    },
    summary: 'Kerr kara deliklerinde dönme olay ufkunu küçültür, çerçeve sürüklenmesine sahip bir ergosfer yaratır, eşyönlü ISCO\'yu içeri çekerek disk verimini $\\%30$–$42$ bandına çıkarır ve Penrose/Blandford–Znajek süreçleriyle dönme enerjisinin çekilmesine olanak tanır.',
    actions: [
      { label: 'Simülasyonu aç: Kerr: Ergosfer & ISCO', tab: 'simulasyonlar', params: { sim: 'bh-kerr' } },
      { label: 'Gözlemevi\'nde gör: Cygnus X-1', tab: 'gozlemevi', params: { preset: 'cygnus-x1' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 9
  // -------------------------------------------------------------------
  {
    id: 'hawking-isimasi-ve-termodinamik',
    number: 9,
    title: 'Hawking Işıması, Kara Delik Termodinamiği ve Bilgi Paradoksu',
    shortTitle: 'Hawking & Termodinamik',
    readingMinutes: 6,
    body: [
      'Klasik genel görelilikte kara delikler hiçbir şey yayamaz ve Hawking\'in **Alan Teoremi**ne göre (1971) olay ufuklarının toplam alanı klasik süreçlerde asla azalamaz: $\\delta A \\ge 0$. Jacob Bekenstein (1972), bu yasanın termodinamiğin ikinci yasasına çarpıcı benzerliğinden yola çıkarak kara deliklerin ufuk alanıyla orantılı devasa bir **entropiye** sahip olması gerektiğini öne sürdü.',
      '1974\'te Stephen Hawking, eğri uzay-zaman üzerinde kuantum alan teorisini uygulayarak şaşırtıcı bir keşif yaptı: kara delikler tamamen siyah değildir; $T_H = \\hbar c^3 / (8\\pi G M k_B)$ sıcaklığında termal kara cisim ışıması (**Hawking ışıması**) yayarlar. Bu keşif Bekenstein–Hawking entropisindeki kesin $1/4$ katsayısını sabitledi: $S = k_B A / (4 \\ell_P^2)$. Kara delik mekaniğinin dört yasası, kelimesi kelimesine gerçek termodinamik yasalardır!',
      'Hawking sıcaklığı $T_H \\propto M^{-1}$ olduğundan yıldızsal ve süperkütleli kara delikler kozmik mikrodalga artalanından ($2,725\\,\\text{K}$) milyarlarca kat daha soğuktur ve bugün net olarak büyürler. Ancak yalıtılmış bir kara delik buharlaşırken küçüldükçe ısınır ($P \\propto M^{-2}$) ve son anlarında şiddetli bir gama patlamasıyla yok olur. Tamamen termal görünen bu ışımanın, kara deliğe düşen maddenin kuantum bilgisini yok edip etmediği sorusu **kara delik bilgi paradoksu**nu doğurur; modern kuantum kütleçekimi çalışmaları (Page eğrisi, holografik ilke ve kuantum aşırı yüzeyler) bilginin buharlaşma sürecinin ikinci yarısında ince kuantum dolanıklıklarıyla geri kazanıldığını göstermektedir.',
    ],
    equations: [
      { label: 'Hawking sıcaklığı ve Bekenstein–Hawking entropisi', tex: 'T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}, \\qquad S = \\frac{k_B c^3 A}{4 G \\hbar} = \\frac{4\\pi G M^2 k_B}{\\hbar c}' },
      { label: 'Hawking ışıma gücü ve buharlaşma süresi', tex: 'P_H = \\frac{\\hbar c^6}{15360\\,\\pi G^2 M^2}, \\qquad t_{\\text{buh}} = \\frac{5120\\,\\pi G^2 M^3}{\\hbar c^4}' },
    ],
    example: {
      title: 'Çözümlü Örnek: 1 M☉ Kara Delik ve Evrenin Yaşında Buharlaşan İlkel Kara Delik',
      problem: '$1\\,M_\\odot$ kara deliğin Hawking sıcaklığını, boyutsuz entropisini ($S/k_B$) ve buharlaşma süresini hesaplayın; ayrıca tam evrenin yaşında ($13,787\\,\\text{milyar yıl}$) buharlaşan ilkel bir kara deliğin başlangıç kütlesini ve sıcaklığını bulun.',
      steps: [
        `$1\\,M_\\odot$ için $T_H \\approx ${fmtTexSci(ex9SunHawk.temperature, 2)}\\,\\text{K}$ ($\\approx ${fmtN(ex9SunHawk.temperature * 1e9, 1)}\\,\\text{nK}$) — $2,725\\,\\text{K}$ CMB\'den katrilyonlarca kat soğuk!`,
        `Boyutsuz Bekenstein–Hawking entropisi $S/k_B \\approx ${fmtTexSci(ex9SunHawk.entropyDimensionless, 2)}$ (Güneş\'in termal entropisinin $\\sim 10^{19}$ katı).`,
        `Yalıtılmış buharlaşma süresi $t_{\\text{buh}} \\approx ${fmtTexSci(ex9SunHawk.evaporationYears, 2)}\\,\\text{yıl}$ — evrenin yaşının $10^{57}$ katı!`,
        `Bugün tam buharlaşmakta olan bir ilkel kara deliğin başlangıç kütlesi $M \\approx ${fmtTexSci(ex9PrimMassKg, 2)}\\,\\text{kg}$ (bir dağ kütlesi, $r_s \\approx ${fmtTexSci(ex9PrimRsM, 2)}\\,\\text{m}$ — atom çekirdeğinden küçük!) ve sıcaklığı $T_H \\approx ${fmtTexSci(ex9PrimTempK, 2)}\\,\\text{K}$ (gama ışınları!).`,
      ],
      result: `$1\\,M_\\odot$: $T_H \\approx ${fmtN(ex9SunHawk.temperature * 1e9, 1)}\\,\\text{nK}$, $t_{\\text{buh}} \\approx ${fmtTexSci(ex9SunHawk.evaporationYears, 2)}\\,\\text{yıl}$; bugün buharlaşan ilkel kütle $${fmtTexSci(ex9PrimMassKg, 2)}\\,\\text{kg}$.`,
    },
    summary: 'Kuantum alan teorisi, kara deliklerin $T_H \\propto M^{-1}$ sıcaklığında ışıma yaptığını ve alanlarıyla orantılı $S = k_B A/(4\\ell_P^2)$ entropisine sahip olduğunu gösterir. Astrofiziksel kara delikler akıl almaz derecede uzun sürede buharlaşırken, Hawking ışıması genel görelilik ile kuantum mekaniğinin kesişimindeki bilgi paradoksunu açığa çıkarır.',
    actions: [
      { label: 'Simülasyonu aç: Hawking Işıması', tab: 'simulasyonlar', params: { sim: 'bh-hawking' } },
      { label: 'Hesaplayıcı\'da test et', tab: 'hesaplayici', params: { mass: 1, unit: 'solar' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 10
  // -------------------------------------------------------------------
  {
    id: 'kutlecekim-dalgalari-ligo',
    number: 10,
    title: 'Kütleçekim Dalgaları ve LIGO / Virgo Gözlemleri',
    shortTitle: 'Kütleçekim Dalgaları',
    readingMinutes: 5,
    body: [
      'İvmelenen kütle dağılımları — özellikle birbirinin etrafında dönen iki kara delik — uzay-zaman dokusunda ışık hızıyla yayılan dörtkutuplu dalgalanmalar (**kütleçekim dalgaları**) oluşturur. Dalga geçerken dik iki eksenden biri uzarken diğeri kısalır; bu göreli uzunluk değişimi boyutsuz **gerinim** $h = \\Delta L / L$ ile ölçülür.',
      'İkili kara delikler kütleçekim dalgalarıyla yörünge enerjisi kaybettikçe birbirine yaklaşır, hızlanır ve dalga frekansı ile genliği giderek yükselir. Bu karakteristik yükselen sinyale **cıvıltı (chirp)** adı verilir. İçe sarmal (inspiral) fazının evrimi neredeyse tamamen tek bir kütle bileşimi olan **cıvıltı kütlesi** $\\mathcal{M}_c = (m_1 m_2)^{3/5}/(m_1 + m_2)^{1/5}$ tarafından belirlenir. İkili ISCO\'ya ulaştığında birleşme gerçekleşir ve yeni oluşan bozuk Kerr kara deliği, bir çan gibi sönümlenen **yarı-normal mod (QNM) çınlaması**yla (ringdown) dengeye oturur.',
      '14 Eylül 2015\'te LIGO\'nun $4\\,\\text{km}$ kol uzunluklu lazer interferometreleri, proton çapının binde biri mertebesindeki ($h \\sim 10^{-21}$) uzunluk değişimini yakalayarak **GW150914** sinyalini — iki kara deliğin birleşmesini — doğrudan saptadı. O günden bu yana LIGO, Virgo ve KAGRA yüzün üzerinde kara delik ve nötron yıldızı birleşmesi kaydederek uzay-zamana yepyeni bir "kulak" kazandırdı.',
    ],
    equations: [
      { label: 'Cıvıltı kütlesi ve ISCO kütleçekim dalgası frekansı', tex: '\\mathcal{M}_c = \\frac{(m_1 m_2)^{3/5}}{(m_1 + m_2)^{1/5}}, \\qquad f_{\\text{ISCO}} = \\frac{c^3}{6^{3/2}\\pi G (m_1 + m_2)}' },
      { label: 'İçe sarmal frekans evrimi ve yüz yüze gerinim genliği', tex: 'f(\\tau) = \\frac{1}{\\pi}\\left(\\frac{5}{256\\,\\tau}\\right)^{3/8}\\left(\\frac{G\\mathcal{M}_c}{c^3}\\right)^{-5/8}, \\qquad h(f, D) = \\frac{4c}{D}\\left(\\frac{G\\mathcal{M}_c}{c^3}\\right)^{5/3}(\\pi f)^{2/3}' },
    ],
    example: {
      title: 'Çözümlü Örnek: GW150914 Birleşmesinin Sayısal Anatomisi',
      problem: 'GW150914 ($m_1 = 36\\,M_\\odot$, $m_2 = 29\\,M_\\odot$, $D = 410\\,\\text{Mpc}$) için cıvıltı kütlesini, $f_{\\text{ISCO}}$ frekansını, yayılan enerjiyi, kalıntı kara delik özelliklerini ve ISCO gerinim genliğini hesaplayın.',
      steps: [
        `Cıvıltı kütlesi $\\mathcal{M}_c \\approx ${fmtN(ex10McSol, 2)}\\,M_\\odot$; toplam kütle $M = 65\\,M_\\odot$ için $f_{\\text{ISCO}} \\approx ${fmtN(ex10FIsco, 1)}\\,\\text{Hz}$.`,
        `Sayısal görelilik uyumuyla kütleçekim dalgalarıyla yayılan enerji $\\Delta E / c^2 \\approx ${fmtN(ex10RadSol, 2)}\\,M_\\odot$ (toplam kütlenin $\\%${fmtN(ex10Rem.radiatedFraction * 100, 1)}$\'i bir saniyeden kısa sürede uzay-zaman dalgasına dönüştü!).`,
        `Kalıntı kara delik kütlesi $M_f \\approx ${fmtN(ex10FinSol, 1)}\\,M_\\odot$, spini $a_f \\approx ${fmtN(ex10Rem.finalSpin, 2)}$ ve temel QNM çınlama frekansı $f_{\\text{QNM}} \\approx ${fmtN(ex10FQnm, 0)}\\,\\text{Hz}$.`,
        `$D = 410\\,\\text{Mpc}$ uzaklıkta ISCO\'daki yüz yüze gerinim genliği $h \\approx ${fmtTexSci(ex10Strain, 2)}$ — LIGO kollarında $\\sim 10^{-18}\\,\\text{m}$ yer değiştirme!`,
      ],
      result: `GW150914: $\\mathcal{M}_c \\approx ${fmtN(ex10McSol, 2)}\\,M_\\odot$, $f_{\\text{ISCO}} \\approx ${fmtN(ex10FIsco, 1)}\\,\\text{Hz}$, $\\Delta E \\approx ${fmtN(ex10RadSol, 2)}\\,M_\\odot c^2$, $f_{\\text{QNM}} \\approx ${fmtN(ex10FQnm, 0)}\\,\\text{Hz}$.`,
    },
    summary: 'İkili kara delik birleşmeleri içe sarmal (chirp), birleşme ve QNM çınlaması evrelerinden geçerek kütlelerinin $\\sim \\%5$\'ini kütleçekim dalgalarıyla yayar. LIGO ve Virgo gözlemleri genel göreliliği en güçlü dinamik alanında doğrudan doğrulamıştır.',
    actions: [
      { label: 'Simülasyonu aç: Kütleçekim Dalgaları', tab: 'simulasyonlar', params: { sim: 'bh-gw' } },
      { label: 'Katalog\'da gör (GW150914)', tab: 'katalog', params: {} },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 11
  // -------------------------------------------------------------------
  {
    id: 'olay-ufku-teleskobu-eht',
    number: 11,
    title: 'Olay Ufku Teleskobu (EHT): M87* (2019) ve Sgr A* (2022) Görüntüleme',
    shortTitle: 'EHT Görüntüleme',
    readingMinutes: 5,
    body: [
      'Bir kara deliğin gölgesini doğrudan görüntülemek gökbilimin en zor çözünürlük problemlerinden biridir. Bir teleskobun kırınım sınırı $\\Delta\\theta \\approx \\lambda / B$ ile verilir; mikroyay saniyesi ($1\\,\\mu\\text{as} = 10^{-6}\\,\\text{arcsec}$, yani Ay yüzeyindeki bir portakalı Dünya\'dan seçmek!) ölçeğine inmek için **Dünya çapında** bir teleskop gerekir.',
      '**Olay Ufku Teleskobu (EHT)**, yerkürenin dört bir yanındaki milimetre-altı radyo teleskoplarını ($\\lambda = 1,3\\,\\text{mm}$, $230\\,\\text{GHz}$) atom saatleriyle eşzamanlayarak **Çok Uzun Tabanlı İnterferometri (VLBI)** tekniğiyle sanal bir Dünya büyüklüğünde çanak ($B \\approx 10\\,700\\,\\text{km}$, $\\Delta\\theta \\approx 25\\,\\mu\\text{as}$) oluşturur. $1,3\\,\\text{mm}$ dalga boyu hem galaktik tozu delip geçer hem de yığılma akışının optikçe inceleştiği pencereye denk gelir.',
      'EHT 2019\'da Başak kümesindeki **M87*** kara deliğinin, 2022\'de ise kendi galaksimizin merkezindeki **Sgr A*** kara deliğinin parlak asimetrik emisyon halkasıyla çevrili gölgesini yayımladı. M87* bin beş yüz kat daha ağır olmasına karşın iki bin kat daha uzakta olduğu için gökyüzünde ikisi neredeyse aynı açısal boyuttadır ($\\sim 40$–$52\\,\\mu\\text{as}$)! Sgr A* görüntüsünün üç yıl daha uzun sürmesinin nedeni ise küçük kütlesi yüzünden yörüngedeki plazmanın saatler değil **dakikalar** içinde değişmesidir.',
    ],
    equations: [
      { label: 'Gölge açısal çapı ve interferometre kırınım çözünürlüğü', tex: '\\theta_{\\text{gölge}} = \\frac{2 b_c}{D} = \\frac{6\\sqrt{3}\\,GM}{c^2 D}, \\qquad \\Delta\\theta_{\\text{VLBI}} \\approx \\frac{\\lambda}{B}' },
    ],
    example: {
      title: 'Çözümlü Örnek: M87* ve Sgr A* Gölge Çapları ile Değişim Sürelerinin Karşılaştırması',
      problem: 'M87* ($6,5\\times 10^9\\,M_\\odot$, $16,8\\,\\text{Mpc}$) ve Sgr A* ($4,15\\times 10^6\\,M_\\odot$, $8,28\\,\\text{kpc}$) için kuramsal Schwarzschild gölge açısal çaplarını ve ISCO yörünge periyotlarını karşılaştırın.',
      steps: [
        `M87* gölge açısal çapı $\\theta_{\\text{M87*}} = 2b_c/D \\approx ${fmtN(ex11M87Uas, 1)}\\,\\mu\\text{as}$ (EHT 2019 gözlemi: $42 \\pm 3\\,\\mu\\text{as}$ halka çapı).`,
        `Sgr A* gölge açısal çapı $\\theta_{\\text{Sgr A*}} \\approx ${fmtN(ex11SgrUas, 1)}\\,\\mu\\text{as}$ (EHT 2022 gözlemi: $51,8 \\pm 2,3\\,\\mu\\text{as}$ — genel görelilik tahminiyle olağanüstü uyum!).`,
        `ISCO yörünge periyodu M87* için $T_{\\text{ISCO}} \\approx ${fmtN(ex11M87PerDays, 1)}\\,\\text{gün}$ (bir gecelik gözlemde sabit bir hedef), Sgr A* için ise yalnızca $T_{\\text{ISCO}} \\approx ${fmtN(ex11SgrPerMin, 1)}\\,\\text{dakika}$ (gözlem sürerken hızla değişen hedef)!`,
      ],
      result: `M87*: $${fmtN(ex11M87Uas, 1)}\\,\\mu\\text{as}$ ($T_{\\text{ISCO}} \\approx ${fmtN(ex11M87PerDays, 1)}\\,\\text{gün}$); Sgr A*: $${fmtN(ex11SgrUas, 1)}\\,\\mu\\text{as}$ ($T_{\\text{ISCO}} \\approx ${fmtN(ex11SgrPerMin, 1)}\\,\\text{dk}$).`,
    },
    summary: 'EHT, Dünya ölçeğindeki $1,3\\,\\text{mm}$ VLBI ağıyla $\\sim 25\\,\\mu\\text{as}$ çözünürlüğe ulaşarak M87* ve Sgr A* gölgelerini doğrudan görüntüledi. Ölçülen halka çapları genel göreliliğin $2b_c/D = 6\\sqrt{3}\\,GM/(c^2 D)$ öngörüsüyle yüksek doğrulukta örtüşmektedir.',
    actions: [
      { label: 'Gözlemevi\'nde gör: M87*', tab: 'gozlemevi', params: { preset: 'm87-star' } },
      { label: 'Gözlemevi\'nde gör: Sgr A*', tab: 'gozlemevi', params: { preset: 'sgr-a' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 12
  // -------------------------------------------------------------------
  {
    id: 'kara-delik-olusumu',
    number: 12,
    title: 'Kara Delikler Nasıl Oluşur? Yıldızsal, Süperkütleli ve İlkel Kara Delikler',
    shortTitle: 'Kara Delik Oluşumu',
    readingMinutes: 5,
    body: [
      'Evrende bilinen ve kuramsal olarak öngörülen kara delikler kütlelerine göre dört ana sınıfa ayrılır. **Yıldızsal kara delikler** ($\\sim 3$–$100\\,M_\\odot$), başlangıç kütlesi $\\gtrsim 20$–$25\\,M_\\odot$ olan dev yıldızların çekirdeğinde demir birikip nükleer yakıt tükendiğinde doğar. Çöken çekirdeğin kütlesi nötron yozlaşma basıncının taşıyabileceği **Tolman–Oppenheimer–Volkoff (TOV) sınırını** ($\\approx 2,2$–$3\\,M_\\odot$) aşarsa hiçbir kuvvet çökmeyi durduramaz ve olay ufku oluşur.',
      '**Orta kütleli kara delikler** ($10^2$–$10^5\\,M_\\odot$), yoğun yıldız kümelerindeki ardışık birleşmelerle veya çok dev yıldızların doğrudan çökmesiyle ortaya çıkar; GW190521\'in $142\\,M_\\odot$\'lik kalıntısı bu sınıfın ilk doğrudan kanıtıdır. Büyük galaksilerin merkezlerindeki **süperkütleli kara delikler** ($10^6$–$10^{10}\\,M_\\odot$) ise erken evrende ilk nesil (Pop III) yıldız kalıntılarının veya doğrudan çöken dev gaz bulutlarının milyarlarca yıl süren gaz yığılması ve galaksi birleşmeleriyle büyümesi sonucu gelişir. Eddington sınırında kütle $M(t) = M_0\\,e^{t/t_S}$ ile katlanarak büyür (**Salpeter zaman ölçeği** $t_S \\approx 45\\,\\text{milyon yıl}$, $\\eta = 0,1$ için).',
      'Son olarak **ilkel (primordial) kara delikler**, yıldızlardan çok önce, Büyük Patlama\'nın ilk saniye kesirlerinde erken evrendeki aşırı yoğunluk dalgalanmalarının doğrudan çökmesiyle oluşmuş olabilecek kuramsal nesnelerdir. Bunlar bir asteroidden onlarca Güneş kütlesine dek geniş bir spektrumda olabilir ve $M \\lesssim 1,7\\times 10^{11}\\,\\text{kg}$ olanları Hawking ışımasıyla evrenin yaşı içinde tamamen buharlaşır.',
    ],
    equations: [
      { label: 'Eddington büyüme yasası (Salpeter zaman ölçeği)', tex: 'M(t) = M_0\\exp\\!\\left(\\frac{t}{t_S}\\right), \\qquad t_S = \\frac{\\eta\\,\\sigma_T c}{4\\pi G m_p (1 - \\eta)} \\approx 4,5\\times 10^7\\,\\text{yıl}' },
      { label: 'İlkel kara delik buharlaşma kütle eşiği', tex: 'M_{\\text{ilkel}} = \\left(\\frac{\\hbar c^4 t_{\\text{evren}}}{5120\\,\\pi G^2}\\right)^{1/3}' },
    ],
    example: {
      title: 'Çözümlü Örnek: Kütle Spektrumunun Üç Ucu (İlkel, Orta ve Kuasar)',
      problem: 'Bugün buharlaşan ilkel kara delik, GW190521 ($142\\,M_\\odot$) ve aşırı kütleli kuasar TON 618 ($4,07\\times 10^{10}\\,M_\\odot$) için olay ufku yarıçaplarını kıyaslayın.',
      steps: [
        `İlkel buharlaşma eşiği ($M \\approx ${fmtTexSci(ex9PrimMassKg, 2)}\\,\\text{kg}$): $r_s \\approx ${fmtTexSci(ex9PrimRsM, 2)}\\,\\text{m}$ — atom çekirdeğinden küçük.`,
        `Orta kütleli GW190521 kalıntısı ($142\\,M_\\odot$): $r_s \\approx ${fmtN(ex12ImbhRsKm, 1)}\\,\\text{km}$ — bir bölge büyüklüğünde.`,
        `TON 618 ($4,07\\times 10^{10}\\,M_\\odot$): $r_s \\approx ${fmtTexSci(ex12TonRsKm, 2)}\\,\\text{km} \\approx ${fmtN(ex12TonRsAU, 0)}\\,\\text{AU}$ — Neptün\'ün $30\\,\\text{AU}$\'luk yörüngesinin $${fmtN(ex12TonRsAU / 30, 1)}$ katı!`,
      ],
      result: `Bilinen ve kuramsal kara delikler $r_s$ açısından femtometrenin altından yüzlerce astronomik birime kadar $28$ onluk mertebeden fazla yayılır.`,
    },
    summary: 'Yıldızsal kara delikler dev yıldızların TOV sınırını aşan çekirdek çökmesiyle, orta kütleliler yoğun küme birleşmeleriyle, süperkütleliler erken tohumların yığılma ve galaksi birleşmeleriyle büyümesiyle, kuramsal ilkel kara delikler ise Büyük Patlama yoğunluk dalgalanmalarıyla oluşur.',
    actions: [
      { label: 'Katalog\'da karşılaştır', tab: 'katalog', params: {} },
      { label: 'Gözlemevi\'nde gör (TON 618)', tab: 'gozlemevi', params: { preset: 'ton-618' } },
    ],
  },

  // -------------------------------------------------------------------
  // DERS 13
  // -------------------------------------------------------------------
  {
    id: 'gozlemsel-kanitlar',
    number: 13,
    title: 'Gözlemsel Kanıtlar: Sgr A* Yıldızları, X-Işını İkilileri ve Astrometri',
    shortTitle: 'Gözlemsel Kanıtlar',
    readingMinutes: 5,
    body: [
      'Kara deliklerin kendileri ışık yaymadığı için varlıkları çok sayıda bağımsız gözlem kanalının bir araya gelmesiyle kesinleştirilmiştir. İlk kanıt yolu **X-ışını ikilileri**dir: 1964\'te keşfedilen **Cygnus X-1**, mavi üstdev yoldaşından çektiği gazı milyonlarca kelvinlik bir yığılma diskinde ısıtarak hızla titreşen X-ışınları yayar. Yoldaş yıldızın Doppler hız eğrisi, görünmeyen ortağın kütlesinin nötron yıldızı TOV sınırının çok üzerinde ($21,2\\,M_\\odot$) olduğunu kanıtlar.',
      'İkinci ve belki en doğrudan dinamik kanıt, Samanyolu merkezindeki **Sgr A*** çevresinde dönen **S-yıldızları**nın 30 yılı aşkın kızılötesi uyarlanabilir optik takibidir (2020 Nobel Fizik Ödülü: Reinhard Genzel ve Andrea Ghez). Özellikle **S2 yıldızı**, $16$ yıllık eliptik yörüngesinin enberi noktasında ($120\\,\\text{AU}$) $7650\\,\\text{km/s}$ ($\\approx \\%2,55\\,c$) hıza ulaşır. VLT/GRAVITY interferometresi 2018\'de S2\'nin kütleçekimsel kırmızıya kaymasını, 2020\'de ise her turdaki **Schwarzschild enberi presesyonunu** doğrudan ölçerek merkezde $4,15\\times 10^6\\,M_\\odot$\'lik kompakt bir kara delik bulunduğunu kanıtladı.',
      'Günümüzde bu iki klasik kanıta üç güçlü yeni pencere eklendi: Avrupa Uzay Ajansı\'nın **Gaia** uydusunun yığılma yapmayan "uykudaki" kara delikleri (Dünya\'ya yalnızca $478\\,\\text{pc}$ uzaklıktaki **Gaia BH1** ve $32,7\\,M_\\odot$\'lik **Gaia BH3**) astrometrik yalpalanmadan yakalaması, **LIGO/Virgo** kütleçekim dalgaları ve **EHT** gölge görüntüleri. Beş bağımsız kanalın tümü aynı Einstein geometrisinde birleşmektedir.',
    ],
    equations: [
      { label: 'İkili sistem kütle fonksiyonu', tex: 'f(M) = \\frac{M_{\\text{BH}}^3 \\sin^3 i}{(M_{\\text{BH}} + M_* )^2} = \\frac{P K_*^3}{2\\pi G}' },
      { label: 'S2 yıldızı genel görelilik enberi presesyonu', tex: '\\Delta\\phi = \\frac{6\\pi G M}{c^2 a (1 - e^2)}' },
    ],
    example: {
      title: 'Çözümlü Örnek: S2 Yıldızının Enberi Kırmızıya Kayması ve Presesyonu',
      problem: 'Sgr A* ($M = 4,15\\times 10^6\\,M_\\odot$) çevresinde dönen S2 yıldızının enberi uzaklığı $r_p \\approx 120\\,\\text{AU}$, yarı-büyük ekseni $a \\approx 970\\,\\text{AU}$ ve dışmerkezliği $e \\approx 0,8846$\'dır. Enberideki kütleçekimsel kırmızıya kayma hızını ve tur başına presesyon açısını hesaplayın.',
      steps: [
        `S2 enberi uzaklığı $r_p / r_s \\approx ${fmtN(ex13S2PeriOverRs, 0)}$ — yıldız olay ufkuna $1500$ kat yakına kadar sokulur.`,
        `Bu noktada saf kütleçekimsel kırmızıya kayma $z_{\\text{kütle}} \\approx ${fmtTexSci(ex13S2GravZ, 2)}$, eşdeğer hız kayması $c\\,z_{\\text{kütle}} \\approx ${fmtN(ex13S2GravKmS, 0)}\\,\\text{km/s}$ (enine Doppler ile birlikte GRAVITY\'nin ölçtüğü $\\approx 200\\,\\text{km/s}$ kayma!).`,
        `Her $16$ yıllık yörüngedeki Schwarzschild presesyonu $\\Delta\\phi = \\frac{6\\pi GM}{c^2 a(1 - e^2)} \\approx ${fmtN(ex13S2PrecArcmin, 1)}'$ (yay dakikası) — GRAVITY 2020 gözlemiyle birebir doğrulandı.`,
        `Karşılaştırma için X-ışını ikilisi Cygnus X-1\'de $r_s \\approx ${fmtN(ex13CygRsKm, 1)}\\,\\text{km}$, eşyönlü ISCO yalnızca $${fmtN(ex13CygIscoKm, 1)}\\,\\text{km}$ olup X-ışını tayfı doğrudan bu iç kenardan gelir.`,
      ],
      result: `S2 enberide $c\\,z_{\\text{kütle}} \\approx ${fmtN(ex13S2GravKmS, 0)}\\,\\text{km/s}$ kırmızıya kayma ve her turda $\\Delta\\phi \\approx ${fmtN(ex13S2PrecArcmin, 1)}'$ presesyon gösterir.`,
    },
    summary: 'X-ışını ikilileri, Sgr A* çevresindeki S-yıldızları, Gaia astrometrisi, LIGO/Virgo kütleçekim dalgaları ve EHT gölge görüntüleri birbirinden bağımsız olarak genel görelilik kara deliklerinin varlığını kesin biçimde doğrulamaktadır.',
    actions: [
      { label: 'Gözlemevi\'nde gör: Sgr A*', tab: 'gozlemevi', params: { preset: 'sgr-a' } },
      { label: 'Katalog\'u keşfet', tab: 'katalog', params: {} },
    ],
  },
]);
