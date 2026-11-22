# TikTok LIVE Kalabalık Oyunu: Durum ve Notlar

> **Bu dosya projenin geliştirme günlüğüdür.** Tanıtım için: [README.tr.md](../README.tr.md). Ne yapıldı, ne kaldı, nasıl çalışır: hepsi burada.
> Detaylı ilk plan: [PLAN.md](../PLAN.md)

---

## Hızlı başlangıç

1. `Start.bat` dosyasına çift tıkla. Gerekli paketler kurulur, oyun açılır: http://localhost:8080
2. Sağdaki **dev paneli** ile test et (TikTok gerekmez).
3. Paneli gizlemek için **D** tuşuna bas.
4. Yayın için temiz görüntü: http://localhost:8080/?capture=1

Testler: `npm test` (8 test).

---

## Durum özeti (2026-11-18)

| Adım | Ne | Durum |
|---|---|---|
| M1 | İskelet: sunucu, tarayıcı, WebSocket | ✅ Bitti |
| M2 | Simülatör ve standart olay şeması | ✅ Bitti |
| M3 | Avatarlar: `JOIN` yazan isimli karakter olur | ✅ Bitti |
| M4 | Kurallar: tema JSON'dan yönetiliyor | ✅ Bitti |
| M5 | Limitler ve stres testi (150 avatar, 181 fps) | ✅ Bitti |
| M6 | TikTok bağlantısı (isteğe bağlı) | ✅ Bitti, gerçek yayında test edildi |
| M7 | Cila: ses, bantlar, liderlik tablosu, kadraj | ✅ Bitti (sesler kulakla kontrol edilmedi) |
| M7b | Gerçek 3D karakterler (Kenney, animasyonlu) | ✅ Bitti |
| M7c | **Boks ringi teması** (şu an aktif tema) | ✅ Bitti |
| M7d | Ring etrafında kırmızı koltuklar, boksör kıyafetleri | ✅ Bitti |
| M7e | Kamera turu, K.O. yakın çekimi, seyirci tezahüratı, ringin 4 tarafı koltuk | ✅ Bitti |
| M7f | Dövüşte seyirci sesleri (uğultu, "oooh", tempo, K.O. coşkusu) | ✅ Bitti |
| M7g | Daha çok koltuk, yeni insan sesi gibi seyirci sesleri, grup halinde kalkan seyirci | ✅ Bitti |
| M7h | Hediye/like ile can artışı, 4 eşit tribün + merdivenler, arena salonu, boksör kıyafeti | ✅ Bitti |
| M7i | Dev panelde kamera ve seyirci ayar sürgüleri (canlı, kaydediliyor) | ✅ Bitti |
| M7j | Arena ışık şovu: foto flaşları, dönen renkli spotlar, LED nabzı, K.O. strobu ve havai fişek | ✅ Bitti |
| M8 | Yakalama: OBS veya LIVE Studio | ⏸ Bekliyor, canlı yayın gerekiyor |
| M9 | Deneme yayını | ⏸ Bekliyor, canlı yayın gerekiyor |

**Temel kural:** her şey TikTok olmadan test edilebilir olmalı. Simülatör hep açık, TikTok sadece isteğe bağlı.

---

## Aktif tema: 🥊 Boxing Night (boks ringi)

`config.json` içinde `"theme": "ring"`. Eski geçit temasına dönmek için `"theme": "default"` yap.

| İzleyici ne yapar | Ne olur |
|---|---|
| Hediye gönderir | 1 elmas = **10 ⭐** puan |
| Beğeni (like) atar | 1 beğeni = **1 ⭐** puan |
| En çok ⭐'ı olan 2 kişi | Ringe çıkar: biri **kırmızı**, biri **mavi** köşeye |
| Ringdeyken hediye veya beğeni gönderir | **Güç** kazanır (daha sert yumruk, en fazla +%150) ve biraz can yeniler |
| Dövüşü kaybeder (can 0) | Yere düşer, K.O. olur, kalabalığa geri iner, puanı **sıfırlanır** |
| Kazanır | Ringde kalır, canı 100'e döner, galibiyet sayısı (🏆) artar |
| Sıradaki en yüksek ⭐ | Boşalan köşeye çıkar ve yeni dövüş başlar |
| `JOIN` / takım rengi / `WAVE` / takip / 500 beğeni | Geçit temasındakiyle aynı |

**Seyirciler:** ringin arkasında yükselen basamaklarda ve iki yanında **kırmızı koltuklar** var (toplam yaklaşık 250 koltuk). Gelen izleyici yandan yürüyerek gelir, en yakın boş koltuğa oturur (`sit` animasyonu) ve ringe bakar. Ringe çıkan kişi koltuğundan kalkar; kaybedince yeniden bir koltuğa oturur.

**Boksörler:** ringe çıkan kişi köşesinin renginde (kırmızı veya mavi) **boks eldiveni** ve **şort** (beyaz kemerli) giyer. Ringde gardı yukarıda bekler (`holding-both` animasyonu). Ringden inince kıyafetler çıkar.

**Dövüş nasıl işler:**
- Dövüş başlamadan önce 2,5 sn "READY" görünür, sonra zil çalar ve "FIGHT!" yazar.
- Her 0,8 sn'de bir yumruk atılır. Gücü fazla olan daha sık vurur.
- Hasar 5–11 arası, gücü olanınki çarpanla artar. Yumrukların %25'i ıskalar (MISS).
- Ekranda can barları, güç yüzdesi (⚡), galibiyet sayısı ve "Next:" sırası görünür.
- Yumrukta hasar sayısı uçar ve vurulan sarsılır. Sert yumrukta kıvılcım çıkar.
- K.O.'da kaybeden yere düşer, kazanan sevinir, konfeti patlar.
- Bir dövüş ortalama 15 sn sürüyor.
- Ringe çıkacak kimse yoksa kazanan bekler, ekranda "Send gifts or likes to climb in!" yazar.

Bütün sayılar [themes/ring.json](../themes/ring.json) içindeki `"ring"` bölümünden ayarlanabilir:
`diamondPoints`, `likePoints`, `punchMs`, `minDamage`, `maxDamage`, `missChance`, `maxBoost`, `boostPer`, `healPerPoint`, `startDelayMs`, `koDelayMs`.

---

## Geçit teması nasıl oynanır ("The Great Parade", `"theme": "default"`)

| İzleyici ne yapar | Ne olur |
|---|---|
| Chat'e `JOIN` yazar | Adıyla bir karakter kalabalığa yürür |
| `BLUE` / `RED` / `GREEN` / `GOLD` yazar | Karakterinin rengi (takımı) değişir |
| `WAVE` yazar | Karakterinin üstünde 👋 baloncuğu çıkar |
| Herhangi bir hediye gönderir | Ön sıraya geçer, parıltı ve zil sesi |
| 100💎 ve üstü hediye gönderir | Kürsüye çıkar, taç takar, havai fişek ve fanfar. Önceki lider ön sıraya iner. |
| Takip eder | Konfeti ve jingle |
| Toplam her 500 beğenide | Bütün kalabalık zıplar, tezahürat sesi |

Kuralları ve yazıları değiştirmek için [themes/default.json](../themes/default.json) dosyasını düzenle. Kod değişikliği gerekmez.

---

## Dev paneli

- **TikTok LIVE (optional):** şu an yayında olan bir kullanıcı adı yaz, **Connect**'e bas. **Stop** ile sadece simülatöre dönülür.
- **Username:** sahte olayların kimden geleceği. Boş bırakırsan rastgele bir isim kullanılır.
- **Send chat / Send gift / Follow / +100 likes / Share:** elle olay gönderir.
- **10 random JOIN:** 10 rastgele kişi katılır.
- **Chaos mode:** saniyede 0–100 rastgele olay gönderir (stres testi).
- **Reset game:** oyunu sıfırlar.
- **Toggle safe zones:** TikTok'un kendi arayüzünün kapladığı alanları kırmızıyla gösterir.
- **Sound on/off, Volume:** ses kontrolü. Tarayıcıda ses için önce sayfaya bir kez tıklamak gerekir.
- **İstatistik kutusu:** fps, avatar sayısı, bekleme kuyruğu, olay, eklenen, çıkarılan ve düşürülen sayıları.

---

## Ayarlar: [config.json](../config.json)

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `source` | `"simulator"` | `"tiktok"` yaparsan açılışta otomatik bağlanır |
| `tiktok.username` | `""` | Bağlanılacak yayın kullanıcı adı |
| `tiktok.signApiKey` | `""` | Euler Stream anahtarı. Boşsa ücretsiz ortak kota kullanılır. |
| `limits.maxAvatars` | 150 | Ekrandaki en fazla karakter sayısı |
| `limits.spawnsPerSecond` | 5 | Saniyede en fazla kaç kişi girer |
| `limits.userCooldownMs` | 2000 | Aynı kişinin komutları arasındaki bekleme süresi |
| `limits.giftProtectMinutes` | 10 | Hediye atan kişi kaç dakika ekrandan atılmaz |
| `limits.frontSlots` | 8 | Ön sıradaki yer sayısı |
| `blocklist` | `[]` | Bu kelimeleri içeren kullanıcı adları yok sayılır |

İsim etiketi ayarları [client/main.js](../client/main.js) dosyasında: `LABEL_MS` (5 sn) ve `MAX_CROWD_LABELS` (10).

---

## Dosya yapısı

```
tiktok-live-game/
  Start.bat               çift tıkla, çalıştır
  config.json             ayarlar
  themes/default.json     geçit teması
  themes/ring.json        boks ringi teması (aktif)
  server/
    index.js              sunucu, WebSocket, kaynak seçimi
    game.js               oyun durumu, kural motoru, limitler
    normalize.js          ham olay -> standart olay (hediye serisi filtresi burada)
    ring.js               boks ringi modu: puanlar, dövüş, K.O., sıra
    sources/simulator.js  sahte olaylar
    sources/tiktok.js     TikTok bağlantısı (TikTok'a dokunan TEK dosya)
    game.test.js          testler
  client/
    index.html, style.css arayüz ve dev paneli
    main.js               3D sahne, avatarlar, efektler, HUD
    sound.js              sentezlenmiş sesler (ses dosyası yok)
    assets/models/        Kenney Mini Characters: 16 karakter (.glb), doku, lisans (CC0)
  events.log              tüm olayların kaydı (gitignore'da)
```

---

## Yapılan güncellemeler (değişiklik günlüğü)

### M1–M5: Çevrimdışı oyun
- Tek bir Node.js sunucusu, tarayıcıda Three.js sahnesi, 1080×1920 dikey ekran.
- Simülatör gerçek TikTok gibi hediye serileri gönderir. Sadece serinin **son** olayı sayılır (test ile doğrulandı).
- Kişi başına tek avatar. Sınır 150; dolunca en uzun süredir hareketsiz olan çıkarılır, hediye atanlar korunur.
- Stres testi: saniyede 50 olay, 30 sn, **181 fps**, 150 avatar.

### İsim etiketi karmaşası düzeltildi
- Ön sıra ve kürsüdekilerin isimleri hep görünür.
- Kalabalıkta isim, katıldıktan veya bir şey yazdıktan sonra 5 sn görünür. Aynı anda en fazla 10 isim.

### M6: TikTok bağlantısı
- `tiktok-live-connector` v2.5 isteğe bağlı paket olarak kuruldu (resmi olmayan bir kütüphane).
- Panelden herhangi bir açık yayına bağlanılabiliyor. Bağlantı koparsa otomatik yeniden dener (2 sn'den 60 sn'ye kadar artan aralıkla).
- **Bulunan hata:** kütüphanenin README'si eski. v2.5'te alan adları farklı (`user.id`, `user.displayId`, `content`). Kod iki yazımı da kabul edecek şekilde düzeltildi.
- Gerçek yayında test edildi: 30 sn'de 51 olay geldi, gerçek bir hediye kişiyi ön sıraya ve tabloya taşıdı.
- İlk denemede `DEVICE_BLOCKED` hatası alındı, otomatik yeniden deneme bağlandı. Arada böyle aksaklıklar beklenebilir.

### M7: Cila
- Sesler Web Audio ile üretiliyor: katılma, hediye, büyük hediye, takip, tezahürat, havai fişek, pop. Panelde ses aç/kapa ve ses seviyesi var.
- Hediye bantları sıraya giriyor (en fazla 6 bekler), animasyonla açılıyor.
- "Top Supporters" tablosunda 🥇🥈🥉 madalyaları var.
- Kamera ayarlandı: kürsü artık TikTok'un alttaki %25'lik chat alanının üstünde kalıyor.

### M7b: Gerçek 3D karakterler
- Kapsül adamların yerine **Kenney Mini Characters 2.0** paketinden 16 karakter (CC0, OpenGameArt aynasından indirildi, `client/assets/models/LICENSE-kenney.txt`).
- Her izleyiciye kullanıcı kimliğine göre sabit bir karakter atanıyor (aynı kişi hep aynı karakter).
- Hazır animasyonlar kullanılıyor: durma (`idle`), yürüme (`walk`), koşma (`sprint`), zıplama (`jump`, tezahüratta), onaylama (`emote-yes`, `WAVE` yazınca).
- Karakterler yürüdükleri yöne dönüyor, durunca kameraya bakıyor. Uzak bir yere (örneğin kürsüye) giderken koşuyorlar.
- Takım rengi artık karakterin ayağının altındaki renkli halkada gösteriliyor. Kürsüdeki liderin tacı saçın üstüne taşındı.
- Performans: 150 animasyonlu karakterle 180 fps.
- **Boş kürsü sorunu çözüldü:** neden hata değil simülatördü. Olayların yaklaşık %15'i hediyeydi ve lider saniyede birkaç kez değişiyordu. Hediye oranı %4'e düşürüldü (gerçek yayına daha yakın) ve uzağa gidenler artık koşuyor.
- Silinen bir karakterin animasyon oynatmaya çalışmasından kaynaklanan konsol hatası düzeltildi.

### M7c: Boks ringi teması
- Yeni tema dosyası `themes/ring.json` ve sunucuda yeni bir mod: `server/ring.js`.
- Hediye ve beğeniler puan veriyor. En yüksek iki kişi ringe çıkıp dövüşüyor, kaybeden iniyor ve puanı sıfırlanıyor, kazanan kalıyor, sıradaki çıkıyor.
- Ringdeyken gönderilen hediye veya beğeni güç ve can veriyor.
- 3D boks ringi: platform, kırmızı ve mavi köşe direkleri, üç sıra halat, spot ışığı, karanlık tribünler.
- Kenney karakterlerinin hazır animasyonları: yumruk (`attack-melee-left/right`), yere düşme (`die`), sevinme (`emote-yes`).
- Ekranda can barları, VS / READY / K.O. yazısı, güç yüzdesi, galibiyet sayısı, sıradakiler. Puan tablosunda birim ⭐.
- Yeni sesler: yumruk, sert yumruk, ıskalama, zil, K.O.
- 2 yeni test: dövüş döngüsü (kaybeden iner, puanı sıfırlanır, sıradaki çıkar) ve beğenilerin puana dönmesi.
- Saniyede 50 olay ile test edildi: 178 fps, 0 hata.

### M7d: Koltuklar ve boksör kıyafetleri
- Ringin arkasında 12 sıra basamaklı tribün, iki yanında 3'er sütun koltuk. Koltuklar kırmızı, tek bir InstancedMesh ile çiziliyor (performans için).
- Seyirciler ayakta durmak yerine oturuyor ve ringe dönük bakıyor. Koltuğa giderken yürüyor, yaklaşınca basamağa çıkıyor.
- Ring modunda karakterler sahneye yandan giriyor. Geçit temasında eski ayakta duran kalabalık aynen duruyor.
- Ringdeki iki kişiye köşe renginde eldiven ve şort ekleniyor. Modellerin temel pozu T-poz olduğu için eldivenler kolun ucuna yerleştirildi.
- Boksörler ringde gard pozisyonunda bekliyor.
- Test: saniyede 50 olay, 150 karakter, 179 fps, 0 hata.

---

### M7e: Kamera turu ve tezahürat
- **Kamera turu:** her 45 snde
### M7f: Dövüşte seyirci sesleri
- **Sürekli arena uğultusu:** dövüş yokken hafif, dövüş başlayınca yükselir, biri K.O.'ya yaklaşınca (can 30'un altında) en yüksek seviyeye çıkar. Kendi kendine dalgalanır.
- **Vuruşlara tepki:** isabetli yumruklarda "oooh", sert yumrukta ya da can azken büyük "OHHH!", ıskalamada bazen hayal kırıklığıyla "aww".
- **Tempo:** dövüş boyunca yaklaşık 6 sn'de bir seyirci "alkış alkış HEY!" yapar.
- **K.O.:** zilin üstüne büyük bir seyirci coşkusu ve ıslıklar.
- Hepsi Web Audio ile üretiliyor, ses dosyası yok. Ses düğmesi ve ses ayarı bunları da etkiler.
- Tempo sıklığı: [themes/ring.json](../themes/ring.json) → `"chant"` → `supportEverySec` (0 = kapalı).
- Tarayıcıda 0 hata ile çalıştı. Seslerin kulağa nasıl geldiği henüz dinlenerek kontrol edilmedi.

---

### M7g: Daha çok koltuk, yeni seyirci sesleri, grup tezahüratı
- **Koltuklar:** yanlarda 3 yerine 8 sıra yükselen tribün, önde 3 yerine 6 sıra. Artık 4 taraf da dolu.
- **Ses yeniden yapıldı:** M7f'deki uğultu (cızırtı ve derin ses gibi geliyordu) kaldırıldı. Seyirci sesleri artık çok sayıda insan sesi gibi üretiliyor: "oooh", "OHHH!", "aww", "alkış alkış HEY!", K.O. coşkusu, şarkı gibi "O-LÉ, O-LÉ, O-LÉ" tezahüratı.
- **Grup tezahüratı:** seyirciler tek tek değil, yan yana 14 kişilik gruplar halinde kalkıp zıplıyor ve "o-LEY!" diye bağırıyor. Yaklaşık 2,5 sn'de bir, dövüşte 2 kat daha sık. Vuruşlarda da gruplar kalkıyor.
- Yeni ayarlar [themes/ring.json](../themes/ring.json) → `"chant"`: `groupEverySec` (grup sıklığı, 0 = kapalı), `groupSize` (gruptaki kişi), `fightGroupBoost` (dövüşte kaç kat sık), `punchReact` (sert yumrukta kalkanların oranı), `koReact` (K.O.'da kalkanların oranı).
- Tarayıcıda 181 fps, 0 hata. Sesleri kulakla dinlemek kullanıcıda.
- **Sıradaki konu:** gerçek boksör modelleri. Ücretsiz (CC0), iskeletli ve yumruk animasyonlu hazır bir boksör paketi bulunamadı (bkz. sohbet).

---

### M7h: Can artışı, arena salonu, boksör kıyafeti
- **Can artışı:** ringdeki boksör hediye veya like gönderirse canı artar. Varsayılan: 1 like = 0,5 can, 1 elmas = 5 can (en fazla 100). Boksörün üstünde yeşil "+5 ❤️" yazısı çıkar, büyük hediyede yeşil kıvılcım. Ayar: [themes/ring.json](../themes/ring.json) → `"ring"` → `healPerPoint` (puan başına can; 1 elmas = 10 puan).
- **Tribünler:** ringin 4 tarafında da eşit, 12'şer sıra yükselen kırmızı koltuk (önceden arka 12, yanlar 8, ön 6 sıraydı).
- **Merdivenler:** her köşede tribün boyunca yükselen gri basamaklar, sarı kenar çizgileriyle.
- **Arena salonu:** tribünlerin arkasında duvarlar ve üzerlerinde kırmızı/mavi LED şeritler, ring çevresinde koyu halı ve kırmızı çerçeve, ringe çıkış basamakları (kırmızı ve mavi köşe), ringin üstünde spot ışıklı ışık iskelesi ve 4 yüzlü dev ekran. Kamera turu artık seyircinin içinden değil, üstünden uçuyor.
- **Boksör kıyafeti:** ringe çıkanlarda daha büyük, başparmaklı eldiven, el bandajı, şort ve köşe renginde kask (yüz açık).
- Kod: sunucu yeni `heal` mesajı gönderiyor ([server/ring.js](../server/ring.js)), istemci yeşil yazıyı gösteriyor. 8 test geçiyor (yeni test: dövüş sırasında hediye atan boksörün canı artıyor), tarayıcıda 181 fps, 0 hata.

---

### M7i: Dev panelde kamera ve seyirci ayarları
Dev panelin altında "🎛️ Kamera & seyirci ayarları" bölümü var. Sürgüyü oynattığın an bütün ekranlarda (OBS dahil) değişir ve [themes/ring.json](../themes/ring.json) dosyasına kaydedilir, yeniden başlatınca kaybolmaz.

| Sürgü | Ayar (ring.json) | Aralık |
|---|---|---|
| Kamera yakınlığı | `camera.zoom` (1 = normal, küçük = yakın) | 0,5–1,25 (daha uzağı duvarın arkasına geçiyor) |
| Kamera yüksekliği | `camera.height` | -5 … 5 |
| Kamera turu sıklığı | `camera.tourEverySec` (0 = kapalı) | 0–180 sn |
| Kamera turu süresi | `camera.tourSec` | 3–30 sn |
| Grup tezahüratına katılan kişi | `chant.groupSize` | 1–60 |
| Grup tezahüratı sıklığı | `chant.groupEverySec` (0 = kapalı) | 0–20 sn |
| Dövüşte grup tezahüratı kaç kat sık | `chant.fightGroupBoost` | 1–5 |
| Tüm tribün tezahüratı ("O-LÉ") sıklığı | `chant.everySec` (0 = kapalı) | 0–120 sn |
| "Alkış alkış HEY" sıklığı | `chant.supportEverySec` (0 = kapalı) | 0–30 sn |

- Sunucu tarafı: yeni `settings` komutu ([server/index.js](../server/index.js)), değerleri sınırlar içinde tutar, herkese gönderir, dosyaya yazar.
- Tarayıcıda denendi, 0 hata, 8 test geçiyor.

---

### M7j: Arena ışık şovu
- **Foto flaşları:** tribünde seyircilerin arasında sürekli fotoğraf makinesi flaşları patlıyor. Dövüşte daha sık, sert yumrukta bir anda 12 flaş, K.O.'da flaş yağmuru.
- **Dönen spotlar:** ışık iskelesinden kırmızı, mavi, beyaz ve mor 4 spot, görünür ışık hüzmeleriyle arenayı tarıyor. Dövüş kızıştıkça hızlanıp parlaklaşıyor.
- **LED duvarlar** heyecana göre nabız gibi yanıp sönüyor.
- **Yumrukta** arena bir an beyaz parlıyor (sert yumrukta daha güçlü).
- **K.O.'da** 1,8 sn strob: spotlar ringe kilitleniyor, LED'ler beyaz çakıyor, 4 köşe direğinden altın renkli havai fişek fışkırıyor.
- Dev panelde yeni sürgü: **Işık şovu** (0 = kapalı, 1 = normal, 2 = çılgın). Ayar: [themes/ring.json](../themes/ring.json) → `"lights"` → `show`.
- Tarayıcıda 181 fps, 0 hata.

---

## Kalan adımlar

### M8: Yakalama (canlıya almadan da önizlenebilir)
Amaç: oyun ekranını yayın programına bağlamak.

**Seçenek A: TikTok LIVE Studio** (stream key gerekmez)
1. LIVE Studio'yu aç, dikey (portrait) moda geç.
2. Kaynak ekle: "Link" veya "Window capture", adres `http://localhost:8080/?capture=1`
3. Boyutu 1080×1920'ye ayarla, kenarda siyah bant kalmadığını kontrol et.

**Seçenek B: OBS Studio** (stream key gerekir, her hesaba verilmez)
1. Sahne çözünürlüğünü 1080×1920 yap: Ayarlar → Video.
2. **Browser Source** ekle:
   - URL: `http://localhost:8080/?capture=1`
   - Genişlik 1080, yükseklik 1920
   - "Control audio via OBS" seçeneğini işaretle. OBS'de ses otomatik çalışır.
3. Stream key: TikTok LIVE ayarlarından al, OBS → Ayarlar → Yayın bölümüne gir.

**M8'de yapılacak kod işleri:**
- Yakalama sayfası tam 1080×1920 olmalı, kenarda boşluk ya da bant kalmamalı.
- Yayın sırasında ikinci bir pencereden veya telefondan test olayı göndermek için gizli bir kontrol sayfası.
- `window.__game` hata ayıklama satırını kaldırmak.

**Bitti sayılır:** OBS veya LIVE Studio önizlemesinde görüntü doğru, ses geliyor, panel görünmüyor.

### M9: Deneme yayını
1. Kendi hesabında kısa bir test yayını aç (mümkünse gizli ya da arkadaşlarla).
2. `config.json` içinde `"source": "tiktok"` yap ve kendi kullanıcı adını yaz.
3. Arkadaşların `JOIN` yazsın, küçük bir hediye (Rose) göndersin, takip etsin.
4. 30 dakika açık kalsın: çökme, bağlantı kopması, fps düşüşü var mı izle.

**Bitti sayılır:** 30 dakika sorunsuz çalıştı, bütün tetikleyiciler gerçek izleyicilerle çalıştı.

**Gereksinimler** (TikTok'un resmi sayfalarından doğrulanmadı):
- Canlı yayın için yaklaşık 1.000 takipçi
- Hediye alabilmek için 18 yaş ve üstü
- OBS kullanacaksan stream key; LIVE Studio için gerekmez

---

## İsteğe bağlı ekstralar (canlıya almadan yapılabilir)
- **Yeni tema:** stadyum, kale ordusu, yarış. Basit temalar sadece JSON dosyası; ring gibi özel kuralı olan temalar biraz kod ister.
- **Ring için fikirler:** turnuva tablosu, "en uzun galibiyet serisi" rekoru, seyircilerin bir boksöre destek olması (örneğin chat'e `RED` veya `BLUE` yazınca o köşeye güç gitmesi).
- **Daha fazla karakter veya kıyafet:** pakette uzaylı, robot, zombi, korsan karakterleri de var; tema için seçilebilir.
- **Kayıt tekrar oynatma:** `events.log` içindeki gerçek olayları çevrimdışı tekrar oynatmak.

---

## Bilinen sorunlar ve notlar
- **TikTok kütüphanesi resmi değil.** Haber vermeden bozulabilir; o durumda oyun simülatörle çalışmaya devam eder.
- **`events.log`** test yayınından gerçek kullanıcı adları içeriyor. Klasörü paylaşmadan önce sil.
- **Three.js** internetten (jsDelivr) yükleniyor; oyunun açılması için internet bağlantısı gerekiyor.
- **Tarayıcıda ses** sayfaya bir kez tıklamadan çalışmaz. OBS'de bu sorun yok.
- **Kurulum dosyası:** önizleme için `PcControl/.claude/launch.json` eklendi.
