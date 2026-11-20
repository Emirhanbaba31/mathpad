// MathPad Lie Groups & Lie Algebras Lessons (Turkish)
// Complete coverage of Pierre Ramond's "Group Theory: A Physicist's Survey"
// Chapters 4.3 (algebraic oscillator parts), 5, 6, 7, 8, 10, and Appendix 2.

export const SU2_LESSONS = [
  {
    id: 'su2-43-osc',
    section: '§4.3',
    title: 'Sonsuz Boyutlu Hilbert Uzayları ve Salınıcı Cebirleri',
    tag: 'Hilbert & Salınıcı',
    body: [
      'Tek boyutlu kuantum harmonik salınıcının $[a, a^\\dagger] = 1$ yok etme–yaratma operatörleri, sonlu boyutlu olmayan $L^2(\\mathbb{R})$ Hilbert uzayını Fock bazında $|n\\rangle = \\frac{(a^\\dagger)^n}{\\sqrt{n!}}|0\\rangle$ ile gerer.',
      'Birden çok salınıcı kipi $a_i, a_i^\\dagger$ ($[a_i, a_j^\\dagger] = \\delta_{ij}$) alındığında kuadratik operatörler $a_i^\\dagger a_j$ doğal olarak Lie cebirlerinin üreteçlerini üretir; bu yöntem **Schwinger salınıcı gerçeklemesi** olarak bilinir.',
    ],
    theorem: '**İki Kipli $SU(2)$ ve Tek Kipli $SU(1,1)$ Gerçeklemeleri:**\n1. İki bozonik kip ($a_1, a_2$) ile $J_+ = a_1^\\dagger a_2$, $J_- = a_2^\\dagger a_1$, $J_3 = \\frac{1}{2}(a_1^\\dagger a_1 - a_2^\\dagger a_2)$ tam $[J_3, J_\\pm] = \\pm J_\\pm$, $[J_+, J_-] = 2J_3$ cebirini sağlar. Toplam kuantum sayısı $N = n_1 + n_2 = 2j$ sabit tutulduğunda tüm spin-$j$ temsilleri elde edilir.\n2. Tek bozonik kip ($a$) ile $K_+ = \\frac{1}{2}(a^\\dagger)^2$, $K_- = \\frac{1}{2}a^2$, $K_0 = \\frac{1}{2}(a^\\dagger a + \\frac{1}{2})$ kompakt olmayan $\\mathfrak{su}(1,1)$ cebirini sağlar ve Fock uzayını çift ($|2n\\rangle \\to D^+_{1/4}$) ve tek ($|2n+1\\rangle \\to D^+_{3/4}$) iki sonsuz boyutlu indirgenemez temsile böler.',
    example: '**Örnek ($N=3$):** $n_1 + n_2 = 3$ olan $4$ durum $|3,0\\rangle, |2,1\\rangle, |1,2\\rangle, |0,3\\rangle$ tam olarak $j = 3/2$ dörtlüsünün $m = +3/2, +1/2, -1/2, -3/2$ baz vektörleridir. Tek kipli $SU(1,1)$ gerçeklemesinde ise her iki parite sektörü de aynı Casimir değerini verir: $Q = k(k-1) = -3/16$.',
    apply: { label: 'SU(2) → SU(1,1) Salınıcı Lab', tab: 'su2-su11' },
  },
  {
    id: 'su2-51-intro',
    section: '§5.1',
    title: 'SU(2) Grubuna ve Lie Cebirine Giriş',
    tag: 'Temel',
    body: [
      'Özel üniter $2\\times 2$ matrisler grubu $SU(2) = \\{U \\in M_2(\\mathbb{C}) : U^\\dagger U = I,\\; \\det U = 1\\}$ üç gerçel parametre ile tanımlanan, basit bağlantılı, kompakt bir Lie grubudur. Geometrik olarak $SU(2)$ manifoldu $3$-küre $S^3 \\subset \\mathbb{R}^4$ ile özdeştir.',
    ],
    theorem: '**$\\mathfrak{su}(2)$ Lie Cebiri:** Birim elemana teğet uzayı geren Hermitik üreteçler $J_1, J_2, J_3$ aşağıdaki temel komütasyon bağıntılarını ve Casimir değişmezini sağlar:\n$$[J_a, J_b] = i\\,\\varepsilon_{abc}\\,J_c, \\qquad [J^2, J_a] = 0, \\qquad J^2 = J_1^2 + J_2^2 + J_3^2$$\nMerdiven operatörleri $J_\\pm = J_1 \\pm i J_2$ için $[J_3, J_\\pm] = \\pm J_\\pm$ ve $[J_+, J_-] = 2J_3$ olur.',
    example: 'En küçük sadık (temel) temsil $j = 1/2$ olup üreteçler Pauli matrislerinin yarısıdır: $J_a = \\frac{1}{2}\\sigma_a$. Burada $\\operatorname{Tr}(J_a J_b) = \\frac{1}{2}\\delta_{ab}$ (Dynkin indeksi $T(\\mathbf{2}) = 1/2$) ve $J^2 = \\frac{3}{4}I_2$ elde edilir.',
    apply: { label: 'SU(2) Matrislerini İncele', tab: 'su2-lab' },
  },
  {
    id: 'su2-52-reps',
    section: '§5.2',
    title: 'SU(2) Temsilleri, Wigner d-Matrisleri ve Clebsch-Gordan',
    tag: 'Temsiller',
    body: [
      'Sonlu boyutlu her indirgenemez $\\mathfrak{su}(2)$ temsili, tek bir yarı-tam veya tam sayı $j \\in \\{0, \\frac{1}{2}, 1, \\frac{3}{2}, \\dots\\}$ ile etiketlenir ve boyutu $\\dim V_j = 2j + 1$ olur.',
    ],
    theorem: '**Merdiven Etkisi ve Tensör Çarpımı:**\n$$J_3 |j,m\\rangle = m|j,m\\rangle, \\qquad J_\\pm |j,m\\rangle = \\sqrt{j(j+1) - m(m\\pm 1)}\\,|j, m\\pm 1\\rangle$$\n$$V_{j_1} \\otimes V_{j_2} \\cong \\bigoplus_{J = |j_1 - j_2|}^{j_1 + j_2} V_J$$\nBileşik baz $|J,M\\rangle = \\sum_{m_1 + m_2 = M} \\langle j_1 m_1; j_2 m_2 | J M \\rangle |j_1 m_1\\rangle |j_2 m_2\\rangle$ dönüşümü **Clebsch-Gordan katsayıları** ile verilir. $y$-ekseni etrafında $\\beta$ açılı dönmenin matris elemanları $d^j_{m\'m}(\\beta) = \\langle j, m\' | e^{-i\\beta J_y} | j, m \\rangle$ **Wigner küçük $d$-matrisleri**dir.',
    example: 'İki spin-$1/2$ parçacık için $\\frac{1}{2} \\otimes \\frac{1}{2} = 1 \\oplus 0$ ($\\mathbf{2}\\otimes\\mathbf{2} = \\mathbf{3}_S \\oplus \\mathbf{1}_A$): üçlü (simetrik) $|1,0\\rangle = \\frac{1}{\\sqrt{2}}(|\\uparrow\\downarrow\\rangle + |\\downarrow\\uparrow\\rangle)$ ve tekli (antisimetrik) $|0,0\\rangle = \\frac{1}{\\sqrt{2}}(|\\uparrow\\downarrow\\rangle - |\\downarrow\\uparrow\\rangle)$.',
    apply: { label: 'Clebsch-Gordan & Wigner d Hesapla', tab: 'su2-lab' },
  },
  {
    id: 'su2-53-exp',
    section: '§5.3',
    title: 'Lie Cebirinden Lie Grubuna: Üstel Gönderim ve 4π Simetrisi',
    tag: 'Üstel Gönderim',
    body: [
      'Lie cebirinin bir elemanı $X = -i\\theta\\,\\hat{n}\\cdot\\vec{J}$ matris üstel serisi $U(\\hat{n},\\theta) = \\exp(-i\\theta\\,\\hat{n}\\cdot\\vec{J})$ aracılığıyla Lie grubu elemanına taşınır.',
    ],
    theorem: '**Çift Örtü Homomorfizması $SU(2) \\to SO(3)$:**\nSpin-$1/2$ temsilinde $U(\\hat{n},\\theta) = \\cos\\frac{\\theta}{2}\\,I - i\\sin\\frac{\\theta}{2}\\,(\\hat{n}\\cdot\\vec{\\sigma})$ olur. $R_{ab} = \\frac{1}{2}\\operatorname{Tr}(\\sigma_a U \\sigma_b U^\\dagger)$ eşlemesi $SU(2)$\'yi $SO(3)$\'e örter ve çekirdeği $\\ker = \\{+I, -I\\} \\cong \\mathbb{Z}_2$\'dir:\n$$SO(3) \\cong SU(2) / \\mathbb{Z}_2$$\nBu nedenle $\\theta = 2\\pi$ dönmesi $SO(3)$\'te birim dönüşüm iken spin-$1/2$ spinöründe **$U(\\hat{n}, 2\\pi) = -I$ işaret değişimi** yaratır; özdeşliğe dönmek için $\\theta = 4\\pi$ gerekir!',
    example: 'Nötron interferometrisi deneyleri (Rauch, Werner 1975), bir spin-$1/2$ nötron demeti manyetik alanda $2\\pi$ döndürüldüğünde girişim deseninin ters fazda ($-1$ çarpanıyla) kaydığını doğrudan ölçmüştür.',
    apply: { label: 'Bloch Küresi 4π Animasyonunu Başlat', tab: 'su2-lab' },
  },
  {
    id: 'su2-54-su11',
    section: '§5.4',
    title: 'SU(2)\'den SU(1,1)\'e: Kompakt Olmayan Gerçek Form',
    tag: 'Kompakt Olmayan',
    body: [
      'Aynı kompleksleştirilmiş Lie cebiri $\\mathfrak{sl}(2,\\mathbb{C})$\'nin iki farklı gerçek formu vardır: kompakt $\\mathfrak{su}(2)$ (küreyi korur) ve kompakt olmayan $\\mathfrak{su}(1,1) \\cong \\mathfrak{so}(2,1) \\cong \\mathfrak{sl}(2,\\mathbb{R})$ (hiperboloidi korur).',
    ],
    theorem: '**Weyl Üniter Hilesi ve Ayrık Seriler:**\n$K_1 = i J_1$, $K_2 = i J_2$, $K_3 = J_3$ tanımlandığında komütatörün biri işaret değiştirir:\n$$[K_1, K_2] = -i K_3, \\qquad [K_2, K_3] = i K_1, \\qquad [K_3, K_1] = i K_2, \\qquad [K_+, K_-] = -2 K_3$$\n$SU(1,1) = \\{U \\in SL(2,\\mathbb{C}) : U^\\dagger \\eta U = \\eta\\}$ ($\\eta = \\operatorname{diag}(1,-1)$) kompakt olmadığından **aşikar olmayan sonlu boyutlu üniter temsili yoktur**! Üniter temsiller sonsuz boyutludur; özellikle pozitif/negatif ayrık seriler $D^\\pm_k$ için $m = \\pm(k, k+1, k+2, \\dots)$ ve Casimir özdeğeri $Q = K_3^2 - K_1^2 - K_2^2 = k(k-1)$ olur.',
    example: '$2\\times 2$ tanımlayıcı temsil üniter değildir (çünkü $K_1, K_2$ anti-Hermitiktir), ancak $\\eta$-sözde-üniterdir: $U(\\eta) = \\exp(-i\\eta K_2) = \\begin{pmatrix}\\cosh(\\eta/2) & \\sinh(\\eta/2)\\\\ \\sinh(\\eta/2) & \\cosh(\\eta/2)\\end{pmatrix}$ bir $(2+1)$B Lorentz ivmelenmesi (boost) üretir.',
    apply: { label: 'SU(1,1) Hiperboloid & Ayrık Seri Lab', tab: 'su2-su11' },
  },
  {
    id: 'su2-55-apps',
    section: '§5.5.1–5.5.3',
    title: 'Seçilmiş SU(2) Uygulamaları: Harmonik Salınıcı, Bohr Atomu ve İzospin',
    tag: 'Fizik Uygulamaları',
    body: [
      '$SU(2)$ simetrisi fizikte yalnızca uzaysal spin için değil, dinamik (gizli) simetriler ve iç kuantum sayıları için de temel rol oynar.',
    ],
    theorem: '**Üç Klasik Fizik Uygulaması (Ramond §5.5):**\n1. **2B İzotropik Harmonik Salınıcı (§5.5.1):** $H = \\hbar\\omega(a_1^\\dagger a_1 + a_2^\\dagger a_2 + 1)$ Hamiltoniyeni $SU(2)$ altında değişmezdir; $N$ enerjili kabuğun $N+1$ katlı dejenereliği tek bir spin $j = N/2$ temsiline oturur.\n2. **Bohr (Hidrojen) Atomu (§5.5.2):** Açısal momentum $\\vec{L}$ ve ölçeklenmiş Runge-Lenz vektörü $\\vec{A}$ birlikte $\\mathfrak{so}(4) \\cong \\mathfrak{su}(2)_+ \\oplus \\mathfrak{su}(2)_-$ üretir ($\\vec{J}_\\pm = \\frac{1}{2}(\\vec{L} \\pm \\vec{A})$). $\\vec{L}\\cdot\\vec{A} = 0$ koşulu $j_+ = j_- = (n-1)/2$ zorlar; böylece $n$. kabuğun $n^2 = (2j_+ + 1)(2j_- + 1) = \\sum_{\\ell=0}^{n-1}(2\\ell+1)$ kazara dejenereliği açıklanır!\n3. **İzotopik Spin (§5.5.3):** Güçlü etkileşme proton ve nötronu aynı $SU(2)_I$ ikilisinin ($I = 1/2$, $I_3 = +1/2$ proton, $-1/2$ nötron) iki durumu gibi görür; piyonlar $(\\pi^+, \\pi^0, \\pi^-)$ bir $I=1$ üçlüsü oluşturur. Elektrik yükü $Q = I_3 + B/2$ ($S=0$ için) olur.',
    example: 'Hidrojen atomunda $n=3$ için $j_+ = j_- = 1$, boyut $(3)(3) = 9$; $SU(2)_L$ (diyagonal alt grup $\\vec{L} = \\vec{J}_+ + \\vec{J}_-$) altında $1 \\otimes 1 = 2 \\oplus 1 \\oplus 0$, yani tam olarak $3d$ ($5$) + $3p$ ($3$) + $3s$ ($1$) = $9$ yörünge durumu elde edilir!',
    apply: { label: 'SU(2) Uygulamalarını Dene', tab: 'su2-lab' },
  },
];

export const SU3_LESSONS = [
  {
    id: 'su3-61-alg',
    section: '§6.1',
    title: 'SU(3) Cebiri, Gell-Mann Matrisleri ve Yapı Sabitleri',
    tag: 'Cebir',
    body: [
      '$SU(3) = \\{U \\in M_3(\\mathbb{C}) : U^\\dagger U = I,\\; \\det U = 1\\}$ grubu rank $2$, boyut $3^2 - 1 = 8$ olan basit, kompakt bir Lie grubudur. Hem güçlü kuvvetin renk ayar grubu ($SU(3)_C$) hem de hafif kuarkların çeşni simetrisi ($SU(3)_F$) olarak fiziğin merkezindedir.',
    ],
    theorem: '**Gell-Mann Matrisleri ve Yapı Sabitleri:** İzleri sıfır olan $8$ Hermitik $\\lambda_a$ matrisi ($T_a = \\frac{1}{2}\\lambda_a$, $\\operatorname{Tr}(\\lambda_a \\lambda_b) = 2\\delta_{ab}$) şu cebiri sağlar:\n$$[\\lambda_a, \\lambda_b] = 2i\\,f_{abc}\\,\\lambda_c, \\qquad \\{\\lambda_a, \\lambda_b\\} = \\frac{4}{3}\\delta_{ab}I_3 + 2\\,d_{abc}\\,\\lambda_c$$\nBurada $f_{abc}$ tam antisimetrik ($f_{123}=1$, $f_{458}=f_{678}=\\frac{\\sqrt{3}}{2}$, $f_{147}=\\frac{1}{2}, \\dots$), $d_{abc}$ ise tam simetriktir ($d_{118}=d_{228}=d_{338}=\\frac{1}{\\sqrt{3}}$, $d_{888}=-\\frac{1}{\\sqrt{3}}, \\dots$).',
    example: 'Cebir üç örtüşen $\\mathfrak{su}(2)$ alt cebiri barındırır: **İzospin** ($T_1, T_2, T_3$ — $u\\leftrightarrow d$), **U-spin** ($T_6, T_7, \\frac{\\sqrt{3}}{2}T_8 - \\frac{1}{2}T_3$ — $d\\leftrightarrow s$) ve **V-spin** ($T_4, T_5, \\frac{\\sqrt{3}}{2}T_8 + \\frac{1}{2}T_3$ — $u\\leftrightarrow s$).',
    apply: { label: 'Gell-Mann & f/d Kaşifini Aç', tab: 'su3-lab' },
  },
  {
    id: 'su3-62-64-bases',
    section: '§6.2–6.4',
    title: 'α-Bazı, ω-Bazı ve α′-Bazı: Kök ve Ağırlık Uzayının Geometrisi',
    tag: 'Bazlar',
    body: [
      'Ramond Bölüm 6.2–6.4, $A_2 = \\mathfrak{su}(3)$ ağırlık düzleminde üç temel koordinat sistemini karşılaştırır; her baz farklı hesaplamaları son derece sadeleştirir.',
    ],
    theorem: '**Üç Baz ve Dönüşüm Kuralları:**\n1. **$\\alpha$-Bazı (§6.2):** Basit kökler $\\alpha_1, \\alpha_2$ ($|\\alpha_1|^2=|\\alpha_2|^2=2$, aralarındaki açı $120^\\circ$) baz alınır. Metrik tensör doğrudan Cartan matrisidir: $A = \\begin{pmatrix}2 & -1\\\\ -1 & 2\\end{pmatrix}$. Pozitif kökler $\\alpha_1, \\alpha_2, \\alpha_1 + \\alpha_2$.\n2. **$\\omega$-Bazı / Dynkin Bazı (§6.3):** Temel ağırlıklar $\\omega_1, \\omega_2$ ikilik koşulu $2(\\omega_i, \\alpha_j)/|\\alpha_j|^2 = \\delta_{ij}$ ile tanımlanır; $\\alpha_i = \\sum_j A_{ij}\\omega_j$ ve $\\omega_i = \\sum_j (A^{-1})_{ij}\\alpha_j$. Her ağırlık tam sayı Dynkin etiketleri $(a_1, a_2)$ taşır; metrik $G = A^{-1} = \\frac{1}{3}\\begin{pmatrix}2 & 1\\\\ 1 & 2\\end{pmatrix}$.\n3. **$\\alpha\'$-Bazı (§6.4):** İki ekseni dikleştirmek için $\\alpha\'_1 = \\alpha_1$ ve $\\alpha\'_2 = \\frac{1}{\\sqrt{3}}(\\alpha_1 + 2\\alpha_2) = \\sqrt{3}\\,\\omega_2$ ($\\alpha\'_1 \\perp \\alpha\'_2$) seçilir. Bu baz doğrudan ortogonal fiziksel Cartan operatörlerini verir:\n$$I_3 = \\frac{1}{2} a_1, \\qquad Y = \\frac{1}{3}(a_1 + 2 a_2), \\qquad T_8 = \\frac{\\sqrt{3}}{2} Y$$',
    example: 'En yüksek ağırlığı $(p, q)$ olan indirgenemez temsilin boyutu ve kuadratik Casimir değeri $\\omega$-bazında tek satırda çıkar: $\\dim(p,q) = \\frac{1}{2}(p+1)(q+1)(p+q+2)$ ve $C_2(p,q) = \\frac{1}{3}(p^2 + pq + q^2 + 3p + 3q)$.',
    apply: { label: 'SU(3) Baz Değiştiriciyi Aç', tab: 'su3-lab' },
  },
  {
    id: 'su3-65-66-triplet',
    section: '§6.5–6.6',
    title: 'Üçlü (Triplet) Temsili ve Chevalley Bazı',
    tag: 'Triplet & Chevalley',
    body: [
      'Temel $\\mathbf{3} = (1,0)$ temsilinin ağırlıkları $u = (1,0)$, $d = (-1,1)$ ve $s = (0,-1)$ bir eşkenar üçgen oluşturur; eşleniği $\\bar{\\mathbf{3}} = (0,1)$ ise ters dönmüş üçgendir ve $\\mathbf{3} \\not\\cong \\bar{\\mathbf{3}}$ olduğundan kompleks temsildir.',
    ],
    theorem: '**Chevalley Bazı (§6.6):**\n$h_1 = \\operatorname{diag}(1,-1,0)$, $h_2 = \\operatorname{diag}(0,1,-1)$, $e_1 = E_{12}$, $e_2 = E_{23}$, $e_3 = [e_1,e_2] = E_{13}$, $f_1 = E_{21}$, $f_2 = E_{32}$, $f_3 = [f_2,f_1] = E_{31}$ seçildiğinde **tüm yapı sabitleri tam sayıdır**:\n$$[h_i, e_j] = A_{ji}\\,e_j, \\qquad [h_i, f_j] = -A_{ji}\\,f_j, \\qquad [e_i, f_j] = \\delta_{ij}\\,h_i$$\nBu tam sayı özelliği Chevalley gruplarını (sonlu cisimler $\\mathbb{F}_q$ üzerinde) tanımlamanın anahtarıdır.',
    example: 'Üçlü temsilinin ağırlıkları üzerinde $I_3, Y$ ve elektrik yükü $Q = I_3 + Y/2$: $u$: $(+1/2, +1/3, +2/3)$, $d$: $(-1/2, +1/3, -1/3)$, $s$: $(0, -2/3, -1/3)$.',
    apply: { label: 'Ağırlık Diyagramlarını Çiz', tab: 'agirlik-diyagram' },
  },
  {
    id: 'su3-67-physics',
    section: '§6.7.1–6.7.4',
    title: 'Fizikte SU(3): 3B Salınıcı, Elliott Modeli, Sakata ve Sekizli Yol',
    tag: 'Fizik & Hadronlar',
    body: [
      'Ramond §6.7, $SU(3)$\'ün atomik/nükleer fizikten parçacık fiziğine uzanan dört büyük uygulamasını bir araya getirir.',
    ],
    theorem: '**Dört Klasik Uygulama:**\n1. **3B İzotropik Harmonik Salınıcı (§6.7.1):** $a_x, a_y, a_z$ kipleriyle $E_N = \\hbar\\omega(N + \\frac{3}{2})$ kabuğu tam simetrik $(N,0)$ temsilidir: $\\dim(N,0) = \\frac{(N+1)(N+2)}{2}$. $SO(3)$ altında $L = N, N-2, \\dots, 1\\text{ veya }0$ olarak dallanır.\n2. **Elliott Nükleer Modeli (§6.7.2):** $sd$-kabuğu çekirdeklerinde ($^{20}\\text{Ne}, ^{24}\\text{Mg}$) deformasyon kuadrupol etkileşmesi $SU(3) \\supset SO(3)$ **özel gömmesi** ile dönme bantları üretir: $K = \\min(p,q), \\min(p,q)-2, \\dots$ ($K=0$ için $L=\\max, \\max-2, \\dots$; $K>0$ için $L=K, K+1, \\dots, K+\\max$).\n3. **Sakata Modeli (§6.7.3):** Temel üçlü olarak $(p, n, \\Lambda)$ seçti; mezonlar $\\mathbf{3}\\otimes\\bar{\\mathbf{3}} = \\mathbf{8}\\oplus\\mathbf{1}$ ile uyuştu fakat baryonlarda deneyle çelişti ve yerini kesirli yüklü kuark modeline ($\\mathbf{3}\\otimes\\mathbf{3}\\otimes\\mathbf{3} = \\mathbf{10}_S \\oplus \\mathbf{8} \\oplus \\mathbf{8} \\oplus \\mathbf{1}_A$) bıraktı.\n4. **Sekizli Yol & Gell-Mann–Okubo (§6.7.4):** $SU(3)_F$ kırılımının $T_8$ (sekizli) bileşeni gibi davranması kütle bağıntısı verir:\n$$M(I, Y) = M_0 + a Y + b\\!\\left[I(I+1) - \\frac{1}{4}Y^2\\right]$$\nBaryon sekizlisinde $2(m_N + m_\\Xi) = 3m_\\Lambda + m_\\Sigma$, baryon onlusunda eşit kütle adımı ($\\sim 148\\text{ MeV}$) çıkar ve **$\\Omega^-$ ($sss, 1672\\text{ MeV}$) keşfinden önce tahmin edilmiştir**!',
    example: 'Baryon onlusunda $\\Delta(1232) \\to \\Sigma^*(1385) \\to \\Xi^*(1533)$ adımları sırasıyla $+153$ ve $+149\\text{ MeV}$ verir; buradan $\\Omega^-$ kütlesi $\\approx 1682\\text{ MeV}$ öngörülür (deneysel: $1672.45\\text{ MeV}$, fark $< \\%0.6$).',
    apply: { label: 'Sekizli Yol & GMO Doğrulamasını Aç', tab: 'sekizli-yol' },
  },
];

export const LIE_LESSONS = [
  {
    id: 'lie-71-72-roots',
    section: '§7.1–7.2',
    title: 'Basit Lie Cebirlerinin Sınıflandırılması ve Basit Kökler',
    tag: 'Sınıflandırma',
    body: [
      'Kompakt yarı-basit her Lie cebiri $\\mathfrak{g}$, maksimal değişmeli **Cartan alt cebiri** $\\mathfrak{h}$ ($\\dim\\mathfrak{h} = r$, **rank**) ve $\\mathfrak{h}$\'nin ortak özuzayları olan $1$-boyutlu **kök uzayları** $\\mathfrak{g}_\\alpha$ toplamına ayrışır (Cartan–Weyl ayrışımı):',
    ],
    theorem: '**Cartan–Weyl Ayrışımı ve Kök Dizileri:**\n$$\\mathfrak{g} = \\mathfrak{h} \\oplus \\bigoplus_{\\alpha \\in \\Delta} \\mathfrak{g}_\\alpha, \\qquad [H_i, E_\\alpha] = \\alpha_i E_\\alpha, \\qquad \\dim\\mathfrak{g} = r + 2|\\Delta^+|$$\nPozitif kökler $\\Delta^+$, başka iki pozitif kökün toplamı yazılamayan $r$ adet **basit kök** $\\alpha_1, \\dots, \\alpha_r$ tarafından negatif olmayan tam sayı katsayılarla üretilir. **Cartan matrisi** $A_{ij} = \\frac{2(\\alpha_i, \\alpha_j)}{|\\alpha_j|^2}$ için $A_{ii}=2$, $A_{ij} \\le 0$ ($i\\neq j$) ve $A_{ij}A_{ji} \\in \\{0, 1, 2, 3\\}$ olur.\n**Kök Dizisi Kuralı:** $\\beta - p\\alpha_k, \\dots, \\beta + q\\alpha_k$ dizisinde $p - q = \\frac{2(\\beta,\\alpha_k)}{|\\alpha_k|^2}$ sağlanır; tüm pozitif kökler bu algoritmayla $A$ matrisinden eksiksiz üretilir.',
    example: 'İki farklı basit kök arasındaki açı $\\cos^2\\theta_{ij} = \\frac{1}{4}A_{ij}A_{ji}$ olduğundan yalnızca $90^\\circ, 120^\\circ, 135^\\circ, 150^\\circ$ olabilir; uzunluk oranı $|\\alpha_{\\text{uzun}}|/|\\alpha_{\\text{kısa}}| \\in \\{1, \\sqrt{2}, \\sqrt{3}\\}$ değerleriyle sınırlıdır.',
    apply: { label: 'Kök Sistemi Gezginini Aç', tab: 'kok-sistemi' },
  },
  {
    id: 'lie-73-75-dynkin',
    section: '§7.3–7.5',
    title: 'Rank-2 Cebirleri, Dynkin Diyagramları ve Ortonormal Bazlar',
    tag: 'Dynkin',
    body: [
      'Cartan–Killing teoremine göre tüm sonlu boyutlu basit kompleks (veya kompakt gerçek) Lie cebirleri dört sonsuz klasik aile ($A_n, B_n, C_n, D_n$) ve tam beş istisnai cebirden ($G_2, F_4, E_6, E_7, E_8$) ibarettir.',
    ],
    theorem: '**Klasik ve İstisnai Aileler:**\n- **$A_n = \\mathfrak{su}(n+1)$** ($n\\ge 1$): $\\dim = n(n+2)$, basit kökler $e_i - e_{i+1}$.\n- **$B_n = \\mathfrak{so}(2n+1)$** ($n\\ge 2$): $\\dim = n(2n+1)$, $e_1-e_2, \\dots, e_{n-1}-e_n, e_n$ (son kök kısa).\n- **$C_n = \\mathfrak{sp}(2n)$** ($n\\ge 2$): $\\dim = n(2n+1)$, $\\frac{1}{\\sqrt{2}}(e_i-e_{i+1}), \\sqrt{2}\\,e_n$ (son kök uzun).\n- **$D_n = \\mathfrak{so}(2n)$** ($n\\ge 3$): $\\dim = n(2n-1)$, $e_1-e_2, \\dots, e_{n-1}-e_n, e_{n-1}+e_n$ (çatal uç).\n- **İstisnai:** $G_2$ ($14$), $F_4$ ($52$), $E_6$ ($78$), $E_7$ ($133$), $E_8$ ($248$).\nDüşük ranklı izomorfizmalar: $A_1 \\cong B_1 \\cong C_1$, $B_2 \\cong C_2$ ($\\mathfrak{so}(5)\\cong\\mathfrak{sp}(4)$), $D_2 \\cong A_1\\oplus A_1$, $D_3 \\cong A_3$ ($\\mathfrak{so}(6)\\cong\\mathfrak{su}(4)$).',
    example: 'Dynkin diyagramında iki düğüm arasındaki çizgi sayısı $A_{ij}A_{ji} \\in \\{0,1,2,3\\}$ kadardır; ok uzun kökten kısa köke doğru işaret eder ($\\Rightarrow$ veya $\\Rrightarrow$).',
    apply: { label: 'Dynkin & Sınıflandırma Lab', tab: 'dynkin-sinif' },
  },
  {
    id: 'lie-81-82-rep',
    section: '§8.1–8.2',
    title: 'Temsil Teorisi Temelleri, Freudenthal ve Young Tabloları',
    tag: 'Temsiller',
    body: [
      'Her sonlu boyutlu indirgenemez temsil, negatif olmayan tam sayı Dynkin etiketlerinden oluşan tek bir **en yüksek ağırlık** $\\Lambda = (a_1, \\dots, a_r) = \\sum a_i\\omega_i$ ile belirlenir. Diğer tüm ağırlıklar $\\Lambda$\'dan basit kökler çıkarılarak elde edilir.',
    ],
    theorem: '**Freudenthal Katlılık Formülü ve $SU(N)$ Kanca-İçerik Kuralı:**\n$$\\big[(\\Lambda+\\rho, \\Lambda+\\rho) - (\\mu+\\rho, \\mu+\\rho)\\big]\\,m(\\mu) = 2 \\sum_{\\alpha > 0} \\sum_{k=1}^{\\infty} (\\mu + k\\alpha, \\alpha)\\,m(\\mu + k\\alpha)$$\nBurada $\\rho = \\sum_{i=1}^r \\omega_i = \\frac{1}{2}\\sum_{\\alpha>0}\\alpha$ Weyl vektörüdür.\n$A_{N-1} = \\mathfrak{su}(N)$ için Dynkin etiketleri ile Young diyagramı satır uzunlukları $\\lambda_i = \\sum_{k=i}^{N-1} a_k$ biçiminde eşleşir ve boyut **kanca-içerik formülü**yle bulunur:\n$$\\dim_N(\\lambda) = \\prod_{(i,j)\\in\\lambda} \\frac{N + j - i}{h_{ij}}$$',
    example: '$A_3 = \\mathfrak{su}(4)$ temel temsilleri: $(1,0,0) = \\mathbf{4}$ (tek kutu), $(0,1,0) = \\mathbf{6}$ ($2\\times 1$ sütun — $SO(6)$ vektörü!), $(0,0,1) = \\bar{\\mathbf{4}}$ ($3\\times 1$ sütun).',
    apply: { label: 'Temsil Hesaplayıcıyı Aç', tab: 'temsil-hesap' },
  },
  {
    id: 'lie-83-weyl',
    section: '§8.3',
    title: 'Weyl Grubu, Yansımalar ve Yörüngeler',
    tag: 'Weyl Grubu',
    body: [
      'Her basit kök $\\alpha_i$, kendisine dik hiperdüzlemde bir **Weyl yansıması** $s_i(\\lambda) = \\lambda - \\frac{2(\\lambda,\\alpha_i)}{|\\alpha_i|^2}\\alpha_i$ tanımlar; Dynkin etiketlerinde bu $s_i(\\lambda)_j = \\lambda_j - \\lambda_i A_{ij}$ demektir.',
    ],
    theorem: '**Weyl Grubu $W(\\mathfrak{g})$ Özellikleri:**\n1. $W$, $s_1, \\dots, s_r$ yansımaları tarafından üretilen sonlu bir Coxeter grubudur ($s_i^2 = 1$).\n2. Her ağırlığın Weyl yörüngesi baskın Weyl odasında ($\\lambda_i \\ge 0$) **bir ve yalnız bir** baskın temsilci içerir; aynı yörüngedeki tüm ağırlıkların katlılığı eşittir.\n3. $|W| = \\prod_{i=1}^r (m_i + 1)$ ($m_i$: üsler): $|W(A_n)|=(n+1)!$, $|W(B_n)|=|W(C_n)|=2^n n!$, $|W(D_n)|=2^{n-1}n!$, $|W(G_2)|=12$, $|W(F_4)|=1152$, $|W(E_6)|=51\\,840$, $|W(E_7)|=2\\,903\\,040$, $|W(E_8)|=696\\,729\\,600$.',
    example: '$A_2 = \\mathfrak{su}(3)$ için $W(A_2) \\cong S_3$ ($|W|=6$). $(1,0)$ temel ağırlığı bir yansıma duvarı üzerinde oturduğundan yörüngesi $3$ noktalı üçgen, $(1,1)$ iç noktası ise $6$ noktalı altıgen oluşturur.',
    apply: { label: 'Canlı Weyl Yörüngesini İzle', tab: 'weyl-grubu' },
  },
  {
    id: 'lie-84-85-spinor',
    section: '§8.4–8.5',
    title: 'Ortogonal Cebirler, Spinör Temsilleri ve Clifford Cebiri',
    tag: 'Spinörler',
    body: [
      'Ortogonal gruplar $SO(d)$, tensör (vektör) temsillerinden elde edilemeyen çift değerli **spinör temsillerine** ($\\operatorname{Spin}(d)$\'nin sadık temsilleri) sahiptir. $SO(2n)$ ve $SO(2n+1)$ davranışları temelden farklılaşır.',
    ],
    theorem: '**Clifford Cebiri ve Bott Mod-8 Periyodikliği:**\n$\\{\\Gamma_\\mu, \\Gamma_\\nu\\} = 2\\delta_{\\mu\\nu} I$ ($\\mu,\\nu=1,\\dots,d$) matrisleri boyut $2^{\\lfloor d/2 \\rfloor}$ uzayda kurulur ve $\\Sigma_{\\mu\\nu} = -\\frac{i}{4}[\\Gamma_\\mu, \\Gamma_\\nu]$ doğrudan $\\mathfrak{so}(d)$ cebirini sağlar:\n- **$SO(2n)$ ($D_n$):** Kiralite operatörü $\\Gamma_* = (-i)^n \\Gamma_1\\cdots\\Gamma_{2n}$ Dirac spinörünü ($2^n$) iki kiral Weyl spinörüne böler: $S_+, S_-$ (her biri boyut $2^{n-1}$). $d \\equiv 0 \\pmod 8$ gerçel (Majorana–Weyl), $d \\equiv 4$ sözde-gerçel, $d \\equiv 2,6$ kompleks ($S_+^* = S_-$; örn. $SO(10)$ için $\\mathbf{16}^* = \\overline{\\mathbf{16}}$!).\n- **$SO(2n+1)$ ($B_n$):** Tek indirgenemez spinör $S$ ($\\dim = 2^n$); $d \\equiv 1,7 \\pmod 8$ gerçel, $d \\equiv 3,5$ sözde-gerçel.\n**$D_4$ Üçlülüğü (Triality):** $SO(8)$\'de vektör $\\mathbf{8}_v$ ve iki Weyl spinörü $\\mathbf{8}_s, \\mathbf{8}_c$ aynı $8$ boyuta sahip olup Dynkin diyagramının $S_3$ dış otomorfizması altında birbirine dönüşür!',
    example: '$SO(10)$ ($D_5$) kiral spinörü $\\mathbf{16} = (0,0,0,0,1)$ komplekstir ve Standart Model\'in bir tam fermiyon neslini ($15$ Weyl fermiyonu + sağ-elli nötrino $\\nu_R$) tek bir indirgenemez temsilde birleştirir!',
    apply: { label: 'Spinör & Clifford Matrislerini Kur', tab: 'spinor-clifford' },
  },
  {
    id: 'lie-86-casimir',
    section: '§8.6',
    title: 'Casimir Değişmezleri, Dynkin İndeksleri ve Tensör Çarpımları',
    tag: 'Değişmezler',
    body: [
      'Rank-$r$ basit bir Lie cebirinin $r$ adet bağımsız Casimir operatörü vardır; bunların dereceleri $d_i = m_i + 1$ ($m_i$: üsler) şeklindedir. En önemlisi kuadratik Casimir $C_2$ ve temsilin normalizasyonunu ölçen Dynkin indeksi $T(R)$\'dir.',
    ],
    theorem: '**Kuadratik Casimir, Dynkin İndeksi ve Toplam Kuralı:**\nUzun kökler $|\\alpha_{\\text{uzun}}|^2 = 2$ normalizasyonunda ($T(\\text{temel } SU(N)) = \\frac{1}{2}$, $T(\\text{vektör } SO(N)) = 1$, $T(\\text{adj}) = h^\\vee$):\n$$C_2(\\Lambda) = \\frac{1}{2}(\\Lambda, \\Lambda + 2\\rho), \\qquad T(\\Lambda) = \\frac{\\dim(\\Lambda)}{\\dim(\\mathfrak{g})}\\,C_2(\\Lambda)$$\n$R_1 \\otimes R_2 = \\bigoplus_k m_k R_k$ tensör ayrışımı hem boyut hem Dynkin indeksi korur:\n$$\\dim(R_1)\\dim(R_2) = \\sum_k m_k \\dim(R_k), \\qquad \\dim(R_2)T(R_1) + \\dim(R_1)T(R_2) = \\sum_k m_k T(R_k)$$',
    example: '$SU(3)$ için $\\mathbf{8}\\otimes\\mathbf{8} = \\mathbf{27} \\oplus \\mathbf{10} \\oplus \\overline{\\mathbf{10}} \\oplus \\mathbf{8}_S \\oplus \\mathbf{8}_A \\oplus \\mathbf{1}$. İndeks kontrolü: sol taraf $8\\cdot 3 + 8\\cdot 3 = 48$; sağ taraf $T(27)+T(10)+T(\\overline{10})+2T(8)+T(1) = 27 + 7.5 + 7.5 + 6 + 0 = 48$ ✓!',
    apply: { label: 'Tensör Çarpımı & İndeks Kontrolü', tab: 'tensor-carpim' },
  },
  {
    id: 'lie-87-embed',
    section: '§8.7',
    title: 'Gömmeler, Genişletilmiş Dynkin Diyagramları ve GUT Dallanmaları',
    tag: 'Gömmeler',
    body: [
      'Büyük bir simetri grubu $G$ daha küçük bir alt grup $H \\subset G$\'ye kırıldığında, $G$\'nin indirgenemez temsilleri $H$\'nin indirgenemez temsillerinin direkt toplamına ayrışır (**dallanma kuralları**).',
    ],
    theorem: '**Borel–de Siebenthal Teoremi (Düzenli vs Özel Alt Cebirler):**\nGenişletilmiş Dynkin diyagramına en alçak kök $\\alpha_0 = -\\theta$ eklenir ($\\theta = \\sum_{i=1}^r a_i \\alpha_i$). Diyagramdan bir $\\alpha_k$ düğümü silindiğinde:\n- İşaret $a_k = 1$ ise: kalan diyagram $\\oplus\\,\\mathfrak{u}(1)$ bir maksimal **düzenli** alt cebir verir (örn. $SU(5) \\supset SU(3)\\times SU(2)\\times U(1)$, $SO(10)\\supset SU(5)\\times U(1)$, $E_6\\supset SO(10)\\times U(1)$).\n- İşaret $a_k$ **asal** ise: kalan diyagram doğrudan maksimal düzenli **yarı-basit** alt cebir verir (örn. $G_2$ kısa kökü $a_2 = 3$ silinince $SU(3)$; $E_8$ düğümü $a=3$ silinince $E_6\\times SU(3)$).\n- Düzenli olmayan maksimal alt cebirler **özel (S-) alt cebir**dir (örn. $\\mathfrak{so}(n) \\subset \\mathfrak{su}(n)$, $SU(3) \\supset SO(3)$).',
    example: '**Klasik GUT Zinciri:** $E_6 \\supset SO(10) \\supset SU(5) \\supset SU(3)_C \\times SU(2)_L \\times U(1)_Y$:\n$\\mathbf{27} \\to \\mathbf{16} \\oplus \\mathbf{10} \\oplus \\mathbf{1}$, ardından $\\mathbf{16} \\to \\mathbf{10}_{+1} \\oplus \\bar{\\mathbf{5}}_{-3} \\oplus \\mathbf{1}_{+5}$, ve $\\mathbf{10} \\to (\\mathbf{3},\\mathbf{2})_{+1/6} \\oplus (\\bar{\\mathbf{3}},\\mathbf{1})_{-2/3} \\oplus (\\mathbf{1},\\mathbf{1})_{+1}$.',
    apply: { label: 'GUT Dallanma & Borel-de Siebenthal Lab', tab: 'gomme-gut' },
  },
  {
    id: 'lie-88-89-verma',
    section: '§8.8–8.9',
    title: 'Salınıcı Temsilleri, Verma Modülleri ve Weyl Boyut/Karakter Formülü',
    tag: 'Verma & Weyl',
    body: [
      'Ramond §8.8 salınıcı inşasını (bozonik $SU(N), Sp(2n)$ ve fermiyonik $SO(2n)$ spinörleri) genelleştirir; §8.9 ise tüm en yüksek ağırlık temsillerini üreten evrensel sonsuz boyutlu **Verma modüllerini** tanıtır.',
    ],
    theorem: '**Verma Modülü $M(\\Lambda)$ ve Weyl Formülleri:**\nEn yüksek ağırlık vektörü $v_\\Lambda$ üzerine yalnızca alçaltıcı kök operatörleri $E_{-\\alpha}$ uygulanarak oluşturulan serbest modül $M(\\Lambda)$\'nın ağırlık katlılığı **Kostant parçalanış fonksiyonu** $P(\\Lambda - \\mu)$ ile verilir.\n$\\Lambda$ baskın tam sayı ağırlık olduğunda $s_i \\cdot \\Lambda = s_i(\\Lambda + \\rho) - \\rho$ noktalarında **tekil vektörler** ortaya çıkar; bu alt modüllere bölünerek sonlu boyutlu $L(\\Lambda)$ elde edilir ve **Weyl Karakter / Boyut Formülleri** doğar:\n$$\\operatorname{ch}(L_\\Lambda) = \\frac{\\sum_{w\\in W} \\det(w)\\, e^{w(\\Lambda+\\rho)}}{\\sum_{w\\in W} \\det(w)\\, e^{w(\\rho)}}, \\qquad \\dim(L_\\Lambda) = \\prod_{\\alpha \\in \\Delta^+} \\frac{(\\Lambda + \\rho, \\alpha)}{(\\rho, \\alpha)}$$',
    example: '$\\mathfrak{sl}(2)$ için $e \\cdot f^k v_\\lambda = k(\\lambda - k + 1) f^{k-1} v_\\lambda$. $\\lambda = 3$ için $k = 4$ düzeyinde katsayı sıfırlanır ($4(3-4+1)=0$): $f^4 v_3$ tekil vektördür ve $M(3)/M(-5) \\cong L(3)$ tam $4$-boyutlu spin-$3/2$ temsilidir!',
    apply: { label: 'Verma & Weyl Formülü Lab', tab: 'verma-weyl' },
  },
  {
    id: 'lie-app2',
    section: 'Ek 2',
    title: 'Ek 2: Seçilmiş Basit Lie Cebirlerinin Özellikleri',
    tag: 'Başvuru',
    body: [
      'Ramond Ek 2, fizik ve matematikte en sık karşılaşılan basit Lie cebirlerinin boyut, rank, pozitif kök sayısı, Coxeter sayıları, üsler, merkez, Weyl grubu mertebesi ve en küçük temel temsillerini bir arada sunar.',
    ],
    theorem: '**Temel Özdeşlikler:**\n$$\\sum_{i=1}^r m_i = |\\Delta^+|, \\qquad m_r = h - 1, \\qquad \\dim(\\mathfrak{g}) = r(h + 1), \\qquad |W| = \\prod_{i=1}^r (m_i + 1)$$\nEşit uzunluklu (simply-laced: $A, D, E$) cebirlerde $h = h^\\vee$; eşit uzunluksuz cebirlerde $h^\\vee < h$ ($B_n$: $2n-1 < 2n$; $C_n$: $n+1 < 2n$; $G_2$: $4 < 6$; $F_4$: $9 < 12$).',
    example: '$E_8$ için $r = 8$, üsler $1, 7, 11, 13, 17, 19, 23, 29$: toplam $120 = |\\Delta^+|$, en büyük üs $+1 = 30 = h$, $\\dim = 8\\cdot 31 = 248$, $|W| = 2\\cdot 8\\cdot 12\\cdot 14\\cdot 18\\cdot 20\\cdot 24\\cdot 30 = 696\\,729\\,600$.',
    apply: { label: 'Tam Ek 2 Tablosunu Aç', tab: 'lie-ekler' },
  },
];

export const OTESI_LESSONS = [
  {
    id: 'otesi-101-serre',
    section: '§10.1',
    title: 'Serre Sunumu: Cartan Matrisinden Tüm Lie Cebirini Kurmak',
    tag: 'Serre',
    body: [
      'Bir basit Lie cebirinin yalnızca Cartan matrisi $A$ biliniyorsa tüm cebir yapısı tekil olarak geri kazanılabilir. Jean-Pierre Serre, bunun için $3r$ adet Chevalley üreteci ($h_i, e_i, f_i$) üzerine konacak tam ilişkiler kümesini belirledi.',
    ],
    theorem: '**Serre Teoremi:** Cartan matrisi $A_{ij} = \\langle \\alpha_i, \\alpha_j^\\vee \\rangle$ verilen basit Lie cebiri aşağıdaki bağıntılarla tanımlanır:\n1. $[h_i, h_j] = 0$, $\\quad [e_i, f_j] = \\delta_{ij} h_i$\n2. $[h_i, e_j] = A_{ji}\\,e_j$, $\\quad [h_i, f_j] = -A_{ji}\\,f_j$\n3. **Serre Bağıntıları ($i \\neq j$):**\n$$(\\operatorname{ad} e_i)^{1 - A_{ji}}(e_j) = 0, \\qquad (\\operatorname{ad} f_i)^{1 - A_{ji}}(f_j) = 0$$\nBurada $(\\operatorname{ad} x)(y) = [x, y]$. Bu son bağıntılar çoklu komütatörlerin sonlu adımda sönmesini ve cebirin sonlu boyutlu kalmasını garanti eder.',
    example: '$G_2$ için $A = \\begin{pmatrix}2 & -3\\\\ -1 & 2\\end{pmatrix}$: $[e_1,[e_1,e_2]] = 0$ ($1 - A_{21} = 2$), ancak kısa kök $e_2$ üç kez etki edebilir: $[e_2,[e_2,[e_2,[e_2,e_1]]]] = 0$ ($1 - A_{12} = 4$).',
    apply: { label: 'Serre Bağıntıları Kaşifini Aç', tab: 'kac-moody-super' },
  },
  {
    id: 'otesi-102-kacmoody',
    section: '§10.2',
    title: 'Afin Kac-Moody Cebirleri ve Sugawara Yapısı',
    tag: 'Kac-Moody',
    body: [
      'Serre sunumunda Cartan matrisinin pozitif tanımlı olma koşulu gevşetilip **pozitif yarı-tanımlı** ($\\det \\tilde{A} = 0$, her öz alt matris pozitif tanımlı) genelleştirilmiş Cartan matrisine geçildiğinde sonsuz boyutlu **afin Kac-Moody cebirleri** $\\hat{\\mathfrak{g}} = X_r^{(1)}$ elde edilir. 2B konformal alan teorisi (WZW modelleri) ve sicim teorisinin temel simetri cebirleridir.',
    ],
    theorem: '**Döngü Cebiri, Merkezi Genişleme ve Sugawara Merkezi Yükü:**\n$$[T^a_m, T^b_n] = i f^{abc} T^c_{m+n} + k\\,m\\,\\delta^{ab}\\,\\delta_{m+n,0}$$\nBurada $k \\in \\mathbb{Z}_{>0}$ **düzey (level)**, $a_i$ Kac işaretleri ($\\sum_{i=0}^r a_i \\tilde{A}_{ij} = 0$) ve $a_i^\\vee$ eş-işaretlerdir ($h^\\vee = \\sum_{i=0}^r a_i^\\vee$). Bir $k$ düzeyinde yalnızca $\\sum_{i=0}^r a_i^\\vee \\lambda_i = k$ sağlayan **sonlu sayıda integral alınabilir ağırlık** vardır.\n**Sugawara Yapısı** akım cebirinden doğrudan Virasoro cebirini üretir; merkezi yük:\n$$c(\\hat{\\mathfrak{g}}, k) = \\frac{k\\,\\dim(\\mathfrak{g})}{k + h^\\vee}$$',
    example: '$A_1^{(1)} = \\widehat{\\mathfrak{su}}(2)_k$ için $\\dim=3, h^\\vee=2$: $k=1$ düzeyinde $c = 3/3 = 1$ (serbest bozon), $k=2$ düzeyinde $c = 6/4 = 3/2$ (serbest bozon + Majorana fermiyonu). $E_8^{(1)}$ için $k=1$: $c = 248/(1+30) = 8$ (heterotik sicim)!',
    apply: { label: 'Afin Diyagram & Sugawara Lab', tab: 'kac-moody-super' },
  },
  {
    id: 'otesi-103-super',
    section: '§10.3',
    title: 'Lie Süper Cebirleri ve Kac Sınıflandırması',
    tag: 'Süper Cebirler',
    body: [
      'Bozonları (çift, $\\mathfrak{g}_{\\bar{0}}$) ve fermiyonları (tek, $\\mathfrak{g}_{\\bar{1}}$) tek bir cebirsel çatıda birleştirmek için $\\mathbb{Z}_2$-dereceli **Lie süper cebirleri** $\\mathfrak{g} = \\mathfrak{g}_{\\bar{0}} \\oplus \\mathfrak{g}_{\\bar{1}}$ tanımlanır. İki tek eleman komütatör yerine **anti-komütatör** ile birleşir.',
    ],
    theorem: '**Süper Parantez ve Kac Sınıflandırması (1977):**\n$$[X, Y\\} = XY - (-1)^{|X||Y|} YX$$\nSonlu boyutlu basit klasik Lie süper cebirleri:\n- **Özel lineer:** $A(m-1, n-1) = \\mathfrak{sl}(m|n)$ ($m\\neq n$), $m=n$ için $\\mathfrak{psl}(n|n)$.\n- **Ortosimplektik:** $B(m,n) = \\mathfrak{osp}(2m+1|2n)$, $C(n) = \\mathfrak{osp}(2|2n-2)$, $D(m,n) = \\mathfrak{osp}(2m|2n)$.\n- **İstisnai:** $D(2,1;\\alpha)$ ($\\dim = 9|8$, sürekli $\\alpha$ parametreli!), $G(3)$ ($17|14$, $G_2\\oplus\\mathfrak{sl}_2$), $F(4)$ ($24|16$, $\\mathfrak{so}_7\\oplus\\mathfrak{sl}_2$).\n- **Garip (Strange):** $P(n)$ (periplektik) ve $Q(n)$ (süperboyut $0$).\nSüper-Dynkin diyagramlarında üç tür düğüm bulunur: **bozonik** ($\\circ$), **izotropik fermiyonik** ($\\otimes$, $(\\alpha,\\alpha)=0$) ve **izotropik olmayan fermiyonik** ($\\bullet$). Tek Weyl yansımaları eşdeğer olmayan birden çok süper-Dynkin diyagramına yol açar!',
    example: '$\\mathfrak{sl}(2|1)$ ($\\dim = 4|4$, bozonik $\\mathfrak{sl}(2)\\oplus\\mathfrak{u}(1)$) ayırt edilmiş bazda $\\circ - \\otimes$, almaşık bazda ise $\\otimes - \\otimes$ diyagramına sahiptir. $AdS_5 \\times S^5$ süpersicim kuramının simetri cebiri $\\mathfrak{psu}(2,2|4)$\'tür.',
    apply: { label: 'Süper-Dynkin & Kac Sınıflandırması', tab: 'kac-moody-super' },
  },
];
