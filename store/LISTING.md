# MathPad: Google Play hazırlığı

Bu klasördeki her şey Play Console'a yüklenmek için hazır. Görselleri yeniden üretmek için: `npm run web` açıkken `npx electron scripts/store-shots.cjs`.

| Dosya | Play Console'da nereye |
|---|---|
| `icon-512.png` | Uygulama simgesi |
| `feature-1024x500.png` | Öne çıkan grafik |
| `phone-*.png` (5 adet, 1080×1920) | Telefon ekran görüntüleri |
| `tablet-*.png` (5 adet, 2560×1600) | 7 inç ve 10 inç tablet ekran görüntüleri |
| `dist/MathPad-<sürüm>.aab` | Sürüm → App bundle |

## Mağaza metinleri

**Uygulama adı** (en fazla 30 karakter)
MathPad: Mühendislik Defteri

**Kısa açıklama** (en fazla 80 karakter)
Soru çöz, sonsuz tahtada çiz, devre simüle et. Mühendislik öğrencileri için.

**Tam açıklama**

MathPad, mühendislik öğrencileri için soru çözme defteridir. Derslerini klasörle, her soruyu sonsuz bir tahtada çöz, ilerlemeni takip et.

✦ Sonsuz tahta
Kalem, fosforlu kalem, silgi, metin, çizgi, ok ve şekiller. Elle çizdiğin şekiller düzeltilir. Direnç, kondansatör, bobin, kaynak, diyot, op-amp ve transistör gibi devre sembolleri hazır. Sorunun fotoğrafını ya da PDF'ini tahtaya koy.

✦ Simülasyon merkezi
Devre çözücü: düğüm gerilimleri, dal akımları ve güçler yazarken çözülür (DC ve AC fazör). Geçici durum (RC/RL/RLC), AC fazör, filtre ve Bode, op-amp laboratuvarı, mantık kapıları.

✦ Mühendislik araçları
Bilimsel hesap makinesi, fonksiyon ve Bode grafiği, matris işlemleri, fazör çevirici, direnç renk kodu, ders başına formül notları.

✦ Ders ve istatistik
Her ders için klasör, konu etiketleri, açık / çözüldü / tekrar durumu. Günlük hedef, seri, çalışma süresi ve son 14 günün grafiği. Odak sayacı.

✦ Nova, yapay zekâ öğretmenin (isteğe bağlı)
Kendi Claude ya da Gemini API anahtarınla çalışır. Takıldığın yerde ipucu verir, cevabı hemen söylemez.

✦ Cihazlar arası eşitleme (isteğe bağlı)
Verilerin kendi Google Drive hesabındaki gizli uygulama klasörüne eşitlenir. Telefon, tablet ve bilgisayarda aynı defter.

✦ Gizlilik
Hesap yok, reklam yok, takip yok. Verilerin cihazında durur.

**Kategori:** Eğitim
**Etiketler:** Eğitim, Verimlilik
**Gizlilik politikası URL'si:** https://emirhanbaba31.github.io/mathpad/privacy.html

## Uygulama içeriği formları (Play Console → Politika → Uygulama içeriği)

- **Reklamlar:** Hayır, reklam içermiyor.
- **Uygulama erişimi:** Tüm işlevler kısıtlama olmadan kullanılabilir. Nova ve Drive isteğe bağlıdır ve kullanıcının kendi hesabını gerektirir.
- **İçerik derecelendirmesi:** Anketi doldur. Kategori: "Eğitim / referans". Şiddet, kumar vb. hepsine Hayır. Kullanıcılar arası iletişim: Hayır. Beklenen sonuç: 3+ / Herkes.
- **Hedef kitle:** 18 yaş ve üstü (üniversite öğrencileri). "Çocuklara hitap ediyor mu?" sorusuna Hayır.
- **Haber uygulaması:** Hayır.
- **Veri güvenliği** (önerilen cevaplar; kendi bilgine göre kontrol et):
  - Uygulama veri topluyor ya da paylaşıyor mu? **Evet.** Sebep: Drive eşitleme ve Nova açıldığında içerik cihazdan Google'a / Anthropic'e gider.
  - Toplanan veri türleri: **Uygulama etkinliği → Diğer kullanıcı tarafından oluşturulan içerik** ve **Fotoğraflar ve videolar → Fotoğraflar** (tahta görüntüsü Nova'ya gönderilebilir).
  - Bu veriler **isteğe bağlı**, amaç **Uygulama işlevselliği**.
  - Paylaşım: **Hayır.** Kullanıcının kendi başlattığı ve beklediği aktarımlar paylaşım sayılmaz.
  - Aktarım sırasında şifreleniyor mu? **Evet** (HTTPS).
  - Kullanıcı verilerin silinmesini isteyebilir mi? **Evet.** Drive bağlantısı kesilip uygulama silinebilir, Drive'daki uygulama verisi Google hesabından silinebilir.

## Yayın öncesi kontrol listesi

1. **Geliştirici hesabı:** play.google.com/console adresinden aç. 25 $ tek seferlik ücret ve kimlik doğrulaması gerekir. Bunları sen yapmalısın.
2. **Yeni kişisel hesap kuralı:** İlk yayından önce **kapalı test**te en az **12 test kullanıcısı** uygulamayı **14 gün** boyunca kurulu tutmalı. Sonra "Üretime erişim" başvurusu açılır.
3. **Google Drive girişi herkes için:** Şu an Google Cloud'daki OAuth izin ekranı "Test" modunda. Bu modda yalnızca eklediğin test kullanıcıları giriş yapabilir ve oturum 7 günde bir düşer. Play'deki herkes için:
   - İzin ekranında **"Uygulamayı yayınla" → Üretim**e geç (`drive.appdata` hassas olmayan kapsam, ağır inceleme gerekmez).
   - İstemci kimliği ve gizli anahtarı uygulamaya göm (`js/sync.js` → `BUILTIN`), ki kullanıcılar kopyala-yapıştır yapmasın.
4. **Yükleme anahtarı:** `scripts/android-build.ps1` ilk çalışmada `Belgeler\MathPad-imza\mathpad-upload.jks` dosyasını oluşturur. Bu klasörü ve şifreni yedekle. Play Console'da **Play Uygulama İmzalama**yı açık bırak; anahtar kaybolursa Google'dan sıfırlama istenebilir.
5. **İmza farkı:** Play'den kurulan MathPad ile GitHub'daki APK farklı imzalıdır, birbirinin üzerine kurulmaz. Geçerken eski uygulamayı sil. Verileri korumak için önce Drive eşitlemesi yap ya da yedek al.
