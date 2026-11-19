# MathPad — Geliştirme Planı v2

Hedef: her şey daha akıcı, kişiselleştirilebilir ve paylaşılabilir olsun. Bunun için Windows'a **Setup.exe** ile kurulsun, **kaldırıcısı** da olsun.
İlke: yaratıcı ama sade. Yeni özellik eklemek yerine mevcut olanı parlatmak.

Sıra önemli: **Faz 0 → 1 → 2** bir arada, sonra 3–5. Her faz tek başına bitirilip test edilebilir.

---

## İlerleme
- [x] **Faz 0** — kütüphaneler ve fontlar `vendor/` içinde (`npm run vendor`), internetsiz çalışıyor, CSP eklendi
- [x] **Faz 1** — Electron masaüstü uygulaması + `MathPad-Setup-1.0.0.exe` + kaldırıcı ("verilerim de silinsin mi?" sorusu), `.mathpad` yedek dosyası ilişkilendirmesi. Üretmek için: `Kurulum-Olustur.bat`
- [x] **Faz 7.1** — tasarım dili temeli: hareket token'ları, film greni, imleci izleyen ışık, kayan araç göstergesi, sayfa geçişleri, sayaç animasyonları, süpernova, efekt sesleri, Ayarlar → hareket/ses
- [x] **Faz 2** — çöp kutusu (30 gün, Geri al), günlük otomatik yedek (masaüstü), depolama ekranı, ders paylaşma (.mathpad)
- [x] **Web yayını** — https://emirhanbaba31.github.io/mathpad/ (GitHub Pages, repo: Emirhanbaba31/mathpad). Güncellemek için: değişiklikleri commit'le, `git push` yeter; `sw.js` içindeki VERSION'ı artırmayı unutma.
- [ ] Faz 4 → sıradaki (komut paleti, kırpma, çoklu seçim, şekil düzeltme)

## Faz 0 — Altyapı (diğer her şey buna dayanıyor)

| İş | Neden | Dosya |
|---|---|---|
| CDN kütüphanelerini `vendor/` klasörüne indir (math.js, KaTeX + fontları, pdf.js, jsPDF, Google Fontlar) | İnternetsiz çalışma ve exe içine paketleme için şart | `index.html`, `sw.js`, `js/app.js` |
| `npm` projesi kur (`package.json`) | Electron ve paketleme için | yeni |
| Python bağımlılığını kaldır | Exe kendi içinde çalışacak; `MathPad.bat` yalnızca geliştirme için kalacak | — |

## Faz 1 — Setup.exe + Uninstall (paylaşım)

**Seçim: Electron + electron-builder (NSIS).** Node zaten kurulu. Tek komutla `MathPad-Setup-x.y.z.exe` çıkıyor. Kaldırıcıyı NSIS kendisi üretiyor ve "Uygulamalar ve özellikler" listesine ekliyor.
(Alternatif Tauri ~5 MB ama Rust kurulumu gerekiyor. Electron ~80 MB ama sıfır sürtünme. Electron ile başla.)

- `electron/main.js`: pencere (min 900×600, siyah arka plan, `titleBarStyle` gizli + kendi koyu başlık çubuğu). Tek örnek kilidi. Pencere boyutu ve konumu hatırlanır.
- Uygulama `app://` özel protokolüyle yüklenir. IndexedDB `userData` klasöründe kalıcı olur (`%APPDATA%\MathPad`).
- Kurulum sihirbazı (NSIS, `oneClick: false`): kurulum klasörü seçimi, masaüstü ve Başlat menüsü kısayolu, Türkçe dil, özel ikon, lisans/hoş geldin sayfası.
- **Kaldırıcı:** "Verilerimi de sil" onay kutusu (varsayılan: kapalı → veriler korunur). `deleteAppDataOnUninstall` yerine özel NSIS script, çünkü seçim kullanıcıda olmalı.
- Uygulama içi: Ayarlar → "Veri klasörünü aç" ve "Kaldır" düğmesi (kaldırıcıyı başlatır).
- Dosya ilişkilendirme: `.mathpad` yedek dosyasına çift tıkla → içe aktar.
- Güncelleme (sonra): GitHub Releases + `electron-updater`.
- **Not:** İmzasız exe'de Windows SmartScreen "bilinmeyen yayıncı" uyarısı verir. Paylaşırken "Ek bilgi → Yine de çalıştır" denmesi gerekir. Kod imzalama sertifikası ücretli olduğu için kapsam dışı.
- Web/PWA sürümü de aynı koddan yaşamaya devam eder (GitHub Pages → tablet/telefon).

Komutlar: `npm run dev` (Electron'da aç), `npm run dist` (Setup.exe üret → `dist/`).

## Faz 2 — Depolama ve veri

- **Otomatik yedek:** Günde bir kez (açılışta) `Belgeler\MathPad\Yedekler\` klasörüne `.mathpad` dosyası yaz, son 7'yi tut. Web'de dosyaya yazılamadığı için orada sadece hatırlatma göster ("Son yedek 9 gün önce").
- **Depolama ekranı:** toplam boyut çubuğu, ders başına boyut, en büyük 10 soru. "Fotoğrafları sıkıştır" (kaliteyi %70'e düşürür) ve "Boş soruları temizle" düğmeleri.
- **Çöp kutusu:** silinen soru ve dersler 30 gün burada kalır, geri yüklenebilir. Kalıcı silme sadece buradan yapılır.
- **Seçerek dışa aktarma:** tek ders veya tek soru → `.mathpad` dosyası (arkadaşla paylaşmak için). İçe aktarırken "üzerine yaz" ya da "birleştir" seçilir.
- Ders bazında toplu PDF: dersin çözülmüş tüm soruları tek PDF'te, istersen konuya göre gruplu.
- Veri modeline `version` alanı ekle ve migration fonksiyonu yaz (gelecekteki değişiklikler eski verileri bozmasın).

## Faz 3 — Özelleştirme (Ayarlar → Görünüm)

- **Tema:** Uzay (varsayılan siyah), Derin Uzay (daha koyu, yıldızsız), **Kağıt** (beyaz zemin + siyah mürekkep; gündüz ve yazdırma için). Hepsi aynı token sistemiyle `:root[data-theme]`.
- **Vurgu rengi:** 6 seçenek (beyaz varsayılan, buz mavisi, nebula moru, güneş sarısı, aurora yeşili, mars kırmızısı). Sadece seçili/aktif öğeleri boyar; genel tasarım monokrom kalır.
- **Yıldız efekti:** kapalı / az / normal / çok, kayma hızı.
- **Tahta zemini:** nokta / kare / çizgili / boş. Izgara aralığı.
- **Kalem paleti:** renkleri ve kalınlık ön ayarlarını kullanıcı düzenler (renk seçici). Varsayılan araç.
- Yazı boyutu (küçük/normal/büyük), yoğun düzen, sol menü daraltılabilir.
- Ders özelleştirme: her derse ikon (Σ ∿ ⚡ ∫ ⚙ 🧲 gibi sade glifler) + vurgu rengi; kartlarda ve menüde görünür.
- Panel kartlarını göster/gizle ve sırala (sürükle-bırak).
- Odak sayacı süreleri (çalışma/mola), otomatik mola başlatma, ses seçimi ve sessiz mod.
- Hesap makinesi: açı birimi (derece/radyan), ondalık hassasiyet, mühendislik gösterimi açık/kapalı.

## Faz 4 — Tahta ve araçlar (kullanılabilirlik)

**Tahta**
- **Kement seçim:** birden çok öğeyi seçme, taşıma, kopyalama/yapıştırma (Ctrl+C/V), çoğaltma (Ctrl+D).
- **Şekil düzeltme:** elle çizilen çizgi/daire/dikdörtgen basılı tutulunca düzgün şekle dönüşür (çok etkili, az kod).
- **Kırpma:** eklenen fotoğraf/PDF sayfasını kırpma. Önceki turdan kalan eksik buydu.
- **Sayfa modu:** A4 kılavuzları (PDF çıktısında sayfa sınırları görünür).
- Silgi boyutu ve "kısmi silgi" (çizginin sadece bir kısmını silme).
- **Lazer işaretçi** (iz bırakmayan, 1 sn'de sönen kırmızı iz). Anlatım/ekran paylaşımı için.
- **Devre sembolleri paleti (EEE):** direnç, kondansatör, bobin, kaynaklar, toprak, op-amp, diyot. Tahtaya sürükle, ızgaraya oturur. Diğer bölümler için şablonlar sonra eklenir.
- Matematik yazısı: yazı aracında `$...$` yazılırsa KaTeX olarak çizilir.
- Mini harita (sağ altta tahtanın küçük önizlemesi) ve zoom yüzdesi göstergesi.
- Araç çubuğu: uzun basınca açılan alt menüler (şekiller tek düğmede toplanır). Böylece mobilde kaydırma gerekmez.

**Araçlar**
- **Komut paleti (Ctrl+K):** her şeye yazarak ulaş ("yeni soru", "Bode", "Devre Analizi", "tema"). Tek özellikle en büyük kolaylık.
- Hesap makinesi: geçmiş kalıcı olsun. Sonuca tıkla → tahtaya yazı olarak ekle. Değişkenler paneli (tanımlı R, C, L listesi).
- Grafik: grafiği tahtaya resim olarak ekle. Birden çok Bode'u üst üste çizme. Kök yeri ve Nyquist (Kontrol dersi için).
- Yeni araç: **birim dönüştürücü** (görsel, kategori seçmeli), **sayı tabanı dönüştürücü** (bin/hex/dec, Sayısal Elektronik), **dB ↔ oran**, **seri/paralel ağ hesaplayıcı**.
- Formül kağıdı: formüle tıkla → tahtaya ekle. Arama. Diğer mühendislik bölümleri için hazır paketler (Makine, İnşaat, Bilgisayar), seçilerek yüklenir.

**Akış**
- Soru içinde "İpucu / Cevap" alanı: cevabı yaz, gizli kalsın, tekrar ederken kendini test et.
- Tekrar sistemi: aralıklı tekrar (1–3–7–14 gün). Panelde "Bugün tekrar etmen gereken 4 soru".
- Zorluk etiketi (kolay/orta/zor) ve filtre. Hedefe göre haftalık rapor kartı.
- Etiketler (ara sınav, final, ödev) ve sınav geri sayımı ("Devre final: 12 gün").

## Faz 5 — Animasyon ve cila

Kural: hepsi 150–300 ms, `transform`/`opacity` ile, `prefers-reduced-motion` ve Ayarlar'daki "Animasyonları azalt" seçeneğine uyar.

- Sayfa geçişleri: View Transitions API (soru kartından tahtaya "büyüyerek" açılma).
- Panel: halka ve çubuklar açılışta dolarak gelsin. Sayılar sayarak artsın.
- **Çözüldü anı:** kayan yıldız + halka parlaması. Hedef tamamlanınca kısa bir "süpernova" patlaması (canvas parçacıkları, 1 sn).
- Seri (streak) rozetleri: 3/7/30 gün. Takımyıldız temalı küçük rozetler, Ayarlar'da koleksiyon olarak görünür.
- Kartlar: hover'da hafif 3B eğim + kenar parlaması. Liste öğeleri sırayla belirsin.
- Odak sayacı çalışırken arka plandaki yıldızlar yavaşlasın (sakinlik efekti).
- Toast'lar yerine alttan kayan bildirimler + "Geri al" düğmesi (silme işlemlerinde).
- Boş durumlar için küçük SVG çizimler (astronot + defter, gezegen).
- Açılış ekranı (exe): logo, yörünge animasyonu, ~600 ms.
- İlk açılış turu: 4 adımlı balon rehber (yeni soru → fotoğraf → kalem → çözüldü).

## Faz 6 — Yaratıcı özellikler

★ = etkisi büyük ve kodu az. Önce bunlar.

**Uzay temasını işe dönüştüren fikirler**
- ★ **Kişisel gökyüzü:** Çözdüğün her soru panelde bir yıldız olur, her ders bir takımyıldız. Zor sorular daha parlak, tekrar edilenler titrer. Yıldıza tıklayınca soru açılır. Dönem sonunda kendi gökyüzün oluşur. Sadece canvas, yeni kütüphane gerekmez.
- **Yörünge görünümü:** Dersler gezegen, konular uydu. Bir gezegenin boyutu çalışma süresine göre değişir, hangi derse az zaman ayırdığın tek bakışta görülür.
- **Gece gözlem modu:** Kırmızı-siyah tema (astronomlar gibi). Gece çalışırken gözü yormaz, Ayarlar'dan saate göre otomatik açılır.

**Çalışma şeklini değiştiren fikirler**
- ★ **Çözüm tekrarı (replay):** Tahtadaki çözümü yazıldığı sırayla, video gibi oynatır. Hız ayarı ve zaman çubuğu olur. Sınavdan önce "bu soruyu nasıl çözmüştüm" diye izlersin. Her çizgiye zaman damgası eklemek yeterli.
- ★ **Tahtada canlı hesap:** Yazı aracıyla `par(4.7k, 10k) =` yazıp Enter'a basınca sonuç yanına soluk renkte yazılır. Hesap makinesine gitmeden çözüm içinde hesap yaparsın.
- **Bölünmüş görünüm:** Soru fotoğrafı solda sabit kalır, sağda boş tahtada çözersin. Tahtayı kaydırınca soru kaybolmaz.
- **Odak modu (F11):** Menü, araç çubuğu ve her şey gizlenir; sadece soru, kalem ve sayaç kalır. İsteğe bağlı uzay ambiyansı sesi (kahverengi gürültü veya derin uğultu, WebAudio ile üretilir, dosya gerekmez).
- **Sesli not:** Soruya 30 saniyelik sesli açıklama kaydedilir ("burada işareti karıştırdım"). Tekrar ederken dinlenir.
- **Tablet jestleri:** İki parmakla dokunma geri alır, üç parmak yineler. Kalemi uzun basılı tutunca renk çarkı açılır.

**Öğrenmeyi ölçen fikirler**
- ★ **Hata defteri:** Soru "Tekrar" diye işaretlenirken tek dokunuşla neden seçilir: işlem hatası, kavram eksiği, dikkatsizlik, süre yetmedi. Panelde "hatalarının %60'ı işlem hatası" gibi bir içgörü kartı çıkar.
- ★ **Yıllık ısı haritası:** GitHub tarzı 365 günlük kare takvim; yoğunluk beyazın tonlarıyla gösterilir.
- **Sınav simülasyonu:** Seçilen derslerden (öncelik tekrar listesinde) rastgele N soru, toplam süre ve geri sayım. Sonunda puan, soru başına harcanan süre ve zayıf konular raporu.
- **Hız karnesi:** Konu başına ortalama çözüm süresi ve zamanla değişimi ("Thevenin: 14 dk → 6 dk").
- **Akıllı öneri kartı:** "Elektromanyetik'e 9 gündür bakmadın" ya da "Laplace en yavaş konun, bugün 3 soru?".
- **Formül kartları:** Formül kağıtlarından otomatik bilgi kartları çıkar; önce sol taraf gösterilir, sonra cevap açılır.

**Motivasyon ve paylaşım**
- **Oturum özeti:** Odak sayacı bitince kart çıkar: "45 dk · 6 soru · en hızlı: Soru 12 (3 dk)".
- **Haftalık rapor görseli:** Uzay temalı, paylaşılabilir PNG kartı (hikâye boyutunda): bu hafta çözülenler, seri ve ısı haritası.
- **Arkadaşa meydan okuma:** Soru paketini `.mathpad` dosyası olarak gönderirsin; arkadaşın çözer, süreler karşılaştırılır. Sunucu gerekmez, her şey dosyayla.
- **Rozet takımyıldızları:** İlk 10 soru, 7 günlük seri, gece kuşu (00:00 sonrası), bir dersin hepsini bitirme… Her rozet küçük bir takımyıldız çizimidir.
- Çözüldü anında tablette hafif titreşim (`navigator.vibrate`).

**Sonraya (büyük veya dış servis gerektirir)**
- Fotoğraftaki soruyu metne/LaTeX'e çevirme (OCR). İnternetsiz çözümler ağır, bulut çözümleri API anahtarı ister.
- Cihazlar arası otomatik eşitleme (bir sunucu ya da Google Drive bağlantısı gerekir).

## Faz 7 — Tasarım dili ve animasyon sahneleri

Kullanıcı onayı: Faz 6'daki fikirlerin **hepsi** yapılacak. Bu faz, hepsinin aynı görsel dili konuşmasını sağlıyor.

### 7.1 Tasarım dili: "Gözlemevi"
Uygulama bir gözlemevi kontrol paneli gibi hissettirmeli: siyah boşluk, ince beyaz çizgiler, ölçüm aleti hassasiyeti.

- **Hareket token'ları** (`:root`'ta tanımlanır, her şey bunları kullanır):
  - `--t-fast: 120ms` hover/basma, `--t-med: 220ms` panel/kart, `--t-slow: 480ms` sahne geçişi
  - `--ease-out: cubic-bezier(.2,.8,.2,1)` girişler, `--ease-orbit: cubic-bezier(.65,0,.35,1)` dönen öğeler, hafif yaylanma `cubic-bezier(.3,1.4,.5,1)` sadece başarı anlarında
- **İnce çizgi estetiği:** Kart kenarlarında ışığın dolaştığı 1 px'lik gradyan çerçeve. Mouse'u takip eden yumuşak "ışık sızıntısı" (CSS `--mx/--my` değişkenleri, tek `pointermove` dinleyicisi).
- **Ölçüm detayları:** Başlıkların yanında küçük koordinat/etiket metinleri (`RA 04h 12m`, `SOL 128` gibi). Gün sayacı: "Dönemin 128. günü". Dekoratif ama bilgi taşıyor.
- **Tipografi:** Rakamlar her yerde JetBrains Mono, tabular. Büyük istatistik rakamlarında ince ağırlık + geniş harf aralığı.
- **Grain (film greni):** %3 opaklıkta statik noise katmanı. Siyah yüzeyler "dijital" değil "derin" görünür.
- **İkonlar:** Mevcut set korunur. Seçili ikonun etrafında çok ince yörünge halkası belirir.

### 7.2 Mikro etkileşimler
- **Düğmeler:** Basınca %97 küçülür, bırakınca hafif yaylanır. Primary düğmede hover'da kenar boyunca dönen ışık ("yörünge parıltısı").
- **Araç çubuğu:** Seçili araç göstergesi düğmeler arasında akarak kayar (FLIP). Kalem kalınlığı seçerken önizleme noktası büyür/küçülür.
- **Renk seçimi:** Seçilen renk kısa bir halka dalgası yayar. Kalemin imleci o renge döner.
- **Onay kutuları ve durum:** "Çözüldü"ye basınca tik işareti çizilerek gelir (`stroke-dashoffset`), arkasından buton bir kez parlar.
- **Sayılar:** Değişen her istatistik eski değerden yenisine sayarak geçer (dijital sayaç kayması).
- **Silme:** Öğe "kara deliğe" çekilir: küçülerek döner ve kaybolur. Altta "Geri al" bildirimi çıkar.
- **Sürükle-bırak:** Dosya sürüklenince hedef alan "çekim alanı" gibi nabız atar; bırakınca görsel yerine süzülerek oturur.
- **Yükleme durumları:** Spinner yerine dönen küçük bir yörünge (gezegen + uydu).

### 7.3 Sahneler (büyük anlar)
- **Açılış (exe):** Siyahta tek bir nokta, ışığa dönüşür. Yörünge halkası çizilir, logo belirir ve arayüze "zoom" ile geçilir. Toplam ~700 ms; ikinci açılıştan itibaren 250 ms'lik kısa versiyon.
- **Sayfa geçişleri (View Transitions API):**
  - Soru kartı → tahta: kartın küçük resmi tam ekran tahtaya dönüşerek büyür.
  - Panel ↔ ders: ders satırındaki ilerleme çubuğu, ders sayfasının başlık çubuğuna akar.
  - Desteklemeyen tarayıcıda kısa bir solma (fade) yeterli.
- **Çözüldü:** Tahtanın köşesinden bir kayan yıldız geçer; kişisel gökyüzünde o derse ait takımyıldıza yeni bir yıldız "doğar" (panelde bir sonraki açılışta görünür).
- **Günlük hedef tamam — süpernova:** Hedef halkası parlar ve beyaz bir şok dalgası ekranı tarar. 60 parçacık dağılıp yıldız tozuna döner (canvas, 1.2 sn, sesi isteğe bağlı).
- **Seri kırılmadan devam:** Panel açılınca alev ikonu yerine o günün takımyıldızı kısa süre çizilir (çizgiler noktadan noktaya bağlanır).
- **Odak modu girişi:** Arayüz yanlara kayarak çekilir, yıldızlar "hiperuzay" efektiyle kısa çizgilere uzar ve sakinleşir. Çıkışta tersi oynar.
- **Odak sayacı:** Halka bir yörünge gibidir; üzerinde dönen küçük bir uydu kalan süreyi gösterir. Son 60 saniyede halka yavaşça nabız atar.
- **Rozet kazanma:** Ekran ortasında takımyıldız çizimi noktadan noktaya oluşur, rozetin adı yazılır ve rozet koleksiyon simgesine uçar.
- **Boş durumlar:** Hareketli küçük SVG'ler. Boş ders: süzülen bir astronot defter tutuyor. Tekrar listesi boş: sakin bir gezegen ve "Her şey yörüngede ✦".
- **Gece gözlem modu:** Tema değişiminde ekran kırmızı bir "kızılötesi tarama" çizgisiyle yukarıdan aşağı geçerek dönüşür.

### 7.4 Veri görselleştirme
- **14 gün grafiği:** Çubuklar yerine "sinyal" görünümü (osiloskop çizgisi + ızgara). EEE öğrencisine tanıdık gelir; Ayarlar'dan çubuğa geri dönülebilir.
- **Isı haritası:** Her gün bir yıldız noktası; çok çalışılan günler daha parlak ve büyük. Uzaktan bakınca bir galaksi bandına benzer.
- **Kişisel gökyüzü:** Yavaşça döner (prefers-reduced-motion ile durur). Fareyle sürüklenip yakınlaştırılabilir. Takımyıldız çizgileri hover'da belirir, ders adı yıldızların yanında yazılır.
- **Yörünge görünümü:** Gezegen boyutu = çalışma süresi, yörünge hızı = son 7 gündeki aktivite. Durmuş gezegen "ihmal edilen ders" demek.
- **Hız karnesi:** Konu başına süre, bir "fırlatma rampası" gibi aşağı doğru inen eğri; iyileşme arttıkça eğri yeşile değil **daha parlak beyaza** döner (monokrom kural korunur).

### 7.5 Ses tasarımı (isteğe bağlı, varsayılan kapalı)
Hepsi WebAudio ile anında üretilir, ses dosyası yok:
- Çözüldü: yumuşak iki notalı "ping" (sinüs, 880 → 1320 Hz)
- Süpernova: alçak uğultu + parlak çan
- Sayaç bitti: üç kısa radar bip
- Odak ambiyansı: kahverengi gürültü + çok yavaş değişen alçak tonlu dron

### 7.6 Kurallar (kalite güvencesi)
- Animasyonlar sadece `transform`, `opacity` ve `filter` ile yapılır, 60 fps hedeflenir. Canvas efektleri `requestAnimationFrame` ile çizilir ve sekme gizlenince durur.
- `prefers-reduced-motion` + Ayarlar'daki "Hareket: Tam / Azaltılmış / Kapalı" seçimi her efekte uygulanır.
- Hiçbir animasyon kullanıcıyı bekletmez: tıklama anında işlenir, animasyon arkada oynar.
- Pil tasarrufu: dizüstü bilgisayar pildeyken (Battery API veya Electron `powerMonitor`) yıldız kayması ve parçacıklar otomatik azaltılır.
- Kontrast: Metin her yerde WCAG AA. Parıltı efektleri asla okunabilirliği düşürmez.

## Faz 8 — Son fikirler (yedek liste)

Kullanıcı Faz 7'yi de tamamen onayladı. Bu liste, ilk 7 faz bittikten sonra seçilerek yapılacak.

- **Soru kalitesi damgası:** Çözümün sonunda tek dokunuşla "emin / emin değilim" seçilir. "Emin değilim" olarak çözülenler tekrar listesinde ayrı bir bölümde, soluk yıldız olarak toplanır.
- **Adım adım çözüm katmanları:** Tahtada "Adım +" düğmesi. Her adım ayrı bir katman olur ve çözüm tekrarında adım adım ilerlenir. Sınav öncesi "sadece 1. adımı göster, gerisini ben deneyeyim" modu.
- **Formül → tahta sürükle:** Formül kağıdındaki bir formülü tahtaya sürükleyince KaTeX olarak çizilir. Değişkenlerine tıklayınca değer girilip sonuç hesaplanır.
- **Soru bağlantıları:** "Bu soru şuna benziyor" diye iki soru bağlanır. Gökyüzünde aralarında ince bir çizgi görünür ve zamanla bir bilgi ağı oluşur.
- **Haftalık plan masası:** Pazartesi sabahı "Bu hafta: Devre 20, Kontrol 15 soru" planı kurulur. Panelde her ders için ayrı mini hedef halkası görünür.
- **Ders programı entegrasyonu:** Haftalık ders saatleri girilir. Dersten çıkınca "Bugün Sinyaller'de Fourier işlendi, 3 soru ekleyelim mi?" hatırlatması gelir.
- **Kısayol yazdırma kartı:** Tüm klavye ve kalem jestleri tek sayfalık, yazdırılabilir, uzay temalı bir PDF kartında.
- **Tema mağazası (yerel):** Tema = küçük bir JSON dosyası (renkler, yıldız yoğunluğu, ses). Arkadaşlar `.mathpad-theme` dosyası paylaşabilir.
- **Erişilebilirlik:** Tüm uygulama klavyeyle kullanılabilir. Ekran okuyucu etiketleri, yüksek kontrast teması ve disleksi dostu yazı tipi seçeneği.
- **"Bugün ne çözeyim?" zarı:** Kararsız kalınca bir düğmeyle rastgele soru seçilir; öncelik uzun süredir dokunulmayan ve tekrar bekleyen sorulardadır. Zar animasyonu yerine dönen bir gezegen kullanılır.

---

## Önerilen sıra ve büyüklük

| # | İş | Büyüklük |
|---|---|---|
| 1 | Faz 0 vendor + Faz 1 Electron + Setup/Uninstall | Orta, **paylaşım için tek şart** |
| 2 | Faz 2 otomatik yedek + çöp kutusu + depolama ekranı | Orta |
| 3 | Komut paleti, kement, şekil düzeltme, kırpma | Orta |
| 4 | Faz 3 tema/vurgu/ders ikonları | Küçük–orta |
| 5 | Faz 5 animasyonlar + rozetler + tur | Küçük–orta |
| 6 | Devre sembolleri, aralıklı tekrar, yeni araçlar | Orta |
| 7 | Faz 6'daki ★'lar: kişisel gökyüzü, çözüm tekrarı, tahtada canlı hesap, hata defteri, ısı haritası | Küçük–orta |
| 8 | Faz 6'nın geri kalanı (kullanıcı hepsini onayladı) | Orta–büyük |
| — | Faz 7 tasarım dili ve hareket token'ları **en başta** (1. adımla birlikte) kurulur; sahneler ilgili özellik yapılırken eklenir | Sürekli |

## Bilinen riskler
- **Veri taşıma:** Exe'nin verisi, tarayıcıdaki (localhost) veriden ayrıdır. Geçişte bir kez yedek al → exe'de geri yükle.
- **İmzasız exe:** SmartScreen uyarısı verir (yukarıya bakın).
- **Mobil:** iOS'ta PWA depolaması sınırlıdır. Orada yedek hatırlatması önemli.
