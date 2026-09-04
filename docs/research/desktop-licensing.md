# Masaüstü lisanslama tasarımı

- **Tarih:** 2026-09-04
- **İlgili issue:** [#36 — uygulama electron ile masaüstü uygulaması yapılabilir mi?](https://github.com/boraaaydin/agenthub/issues/36)
- **Ana belge:** [`docs/research/desktop-app-packaging.md`](./desktop-app-packaging.md)
- **Durum:** Karar anlık görüntüsü. **Tasarım belgesidir; uygulama kapsam dışıdır.** Bu görevde lisans kodu yazılmadı, lisans sunucusu kurulmadı, hiçbir bağımlılık eklenmedi.

---

## Özet

Issue #36'nın ikinci sorusu: *"her kullanıcı key satın alıp uygulamayı kullanacak. Sunucudan
kontrol edilebilir uygulama çalışırken belli periyotlarla. Başka neler yapılabilir?"*

**Öneri:** Saf "her açılışta sunucuya sor" modeli yerine **Ed25519 ile imzalı çevrimdışı
lisans dosyası + periyodik çevrimiçi yenileme**. Uygulama, sunucuya ulaşamadığında imzalı
dosyanın son geçerlilik tarihine kadar (~14 gün) çalışmaya devam eder; süre dolduğunda
**kademeli olarak kısıtlanır**, aniden kilitlenmez.

**Neden:** AgentHub'ın kullanıcısı, uçakta / VPN arkasında / kurumsal proxy ardında çalışan
bir geliştirici. Çevrimiçi zorunluluk, korsanı değil dürüst müşteriyi cezalandırır — korsan
zaten ilk gün kontrolü kaldırır.

**Baştan kabul edilen gerçek:** İstemci tarafındaki her lisans kontrolü, makinenin sahibi olan
yetkin bir saldırgan tarafından kaldırılabilir. Lisanslamanın amacı korsanlığı imkânsız kılmak
değil, **sürtünme yaratmak** ve dürüst müşteriye pürüzsüz bir deneyim sunmaktır. Bu belgedeki
hiçbir önlem bunun aksini iddia etmez.

---

## Uçtan uca akış

```
1. Satın alma       Ödeme sağlayıcısı (satıcı kaydı) → webhook
2. Düzenleme        Lisans sunucusu anahtar üretir  →  müşteriye e-posta
3. Etkinleştirme    Uygulama: anahtar + cihaz parmak izi  →  sunucu
                    Sunucu: etkinleştirme limitini kontrol eder
                    Sunucu: Ed25519 ile imzalı lisans dosyası döner
4. Yerel depolama   Uygulama dosyayı işletim sistemine özgü uygulama-verisi dizinine yazar
5. Her açılışta     İmza + son kullanma + cihaz bağlama yerelde doğrulanır (ağ yok)
6. Yenileme         Arka planda, günde bir kez sunucuya yenileme isteği
                    200 → yeni imzalı dosya (son kullanma ileri alınır)
                    403 → iptal edilmiş; dosya silinir, kısıtlama başlar
                    Ağ yok → sessizce geç, mevcut dosya geçerli kaldıkça çalış
7. Devre dışı alma  Kullanıcı cihazı serbest bırakır → koltuk geri kazanılır
```

### Adım ayrıntıları

| Adım | Sunucu tarafı | İstemci tarafı |
| --- | --- | --- |
| **Satın alma** | Ödeme sağlayıcısının webhook'u lisans kaydı yaratır | — |
| **Düzenleme** | Rastgele, okunabilir anahtar üretir (örn. `AGNT-XXXX-XXXX-XXXX-XXXX`); hash'lenmiş halini saklar | — |
| **Etkinleştirme** | Anahtarı doğrular, cihaz sayısını kontrol eder, cihazı kaydeder, lisans dosyasını imzalar | Anahtarı ve cihaz parmak izini gönderir; dönen dosyayı diske yazar |
| **Doğrulama** | — (ağ gerekmez) | Gömülü **açık anahtar** ile imzayı doğrular; `expiresAt`, `deviceId`, `productVersion` alanlarını kontrol eder |
| **Yenileme** | Kaydın hâlâ geçerli olduğunu kontrol eder, yeni `expiresAt` ile yeniden imzalar | Günde bir dener; başarısızlıkta sessizce geçer |
| **İptal** | Kaydı iptal eder; sonraki yenileme 403 döner | 403 aldığında dosyayı siler |

### Lisans dosyası yapısı (öneri)

İmzalanan gövde, tek bir kanonik JSON belgesidir:

```json
{
  "licenseId": "lic_01J…",
  "productId": "agenthub-desktop",
  "plan": "pro",
  "deviceId": "sha256:…",
  "issuedAt": "2026-09-04T10:00:00Z",
  "expiresAt": "2026-09-18T10:00:00Z",
  "entitlements": ["unlimited-sessions", "remote-access"]
}
```

- İmza: **Ed25519**. Açık anahtar uygulamaya gömülür; özel anahtar yalnızca lisans sunucusunda.
- `expiresAt`, aboneliğin bitişi değil **yenileme penceresidir** (~14 gün). Abonelik canlı
  olduğu sürece her yenilemede ileri alınır.
- `entitlements` alanı, ileride kademeli özellik açmayı (özellik geçitlemeyi) kod değişikliği
  olmadan mümkün kılar.

---

## Çevrimiçi periyodik doğrulama ve imzalı çevrimdışı lisans dosyası

Issue'nun önerdiği model birincisi; öneri ikincisidir.

| Kriter | A) Çevrimiçi periyodik doğrulama | B) İmzalı çevrimdışı dosya + periyodik yenileme **(önerilen)** |
| --- | --- | --- |
| **Çevrimdışı çalışma** | Yok veya kırılgan önbellek gerekir | Doğal; `expiresAt`'e kadar sorunsuz |
| **Sunucu bağımlılığı** | Sunucu düşerse **tüm müşteriler** etkilenir | Sunucu düşerse kimse etkilenmez; yalnızca yenileme gecikir |
| **Gecikme / kullanıcı deneyimi** | Açılışta ağ beklemesi | Açılışta ağ yok; doğrulama yerel ve anlık |
| **İptal hızı** | Anında | Bir yenileme periyodu kadar gecikmeli (≤14 gün) |
| **Saat oynatmaya dayanıklılık** | Yüksek (zaman sunucudan) | Ek önlem gerekir (aşağıya bakınız) |
| **Kırılma zorluğu** | Aynı — istemcideki kontrol her iki modelde de kaldırılabilir | Aynı |
| **Gizlilik** | Sürekli sunucu teması | Günde bir istek |
| **Uygulama karmaşıklığı** | Düşük | Orta (imza doğrulama + dosya yönetimi) |

**Karar: B.** Tek gerçek kaybı iptal gecikmesidir; bu da yenileme periyodunu kısaltarak
(örn. 7 gün) ayarlanabilir. Buna karşılık sunucu kesintisinin müşteriyi kilitlememesi, ücretli
bir geliştirici aracı için pazarlık konusu değildir.

---

## Tasarım kararları

### Cihaz bağlama ve etkinleştirme limitleri

- **Cihaz parmak izi:** kararlı ve düşük gizlilik riskli alanlardan türetilen bir hash
  (makine adı + OS kullanıcı adı + kalıcı bir kurulum UUID'si). Donanım seri numarası gibi
  değiştirilemez tanımlayıcılardan kaçınılmalı: donanım değişiminde müşteri kilitlenir.
- **Varsayılan:** lisans başına **3 cihaz**. Geliştiriciler laptop + masaüstü + VM kullanır;
  1 cihaz limiti destek bileti üretir.
- **Kendi kendine serbest bırakma:** kullanıcı, uygulama içinden cihazı devre dışı bırakıp
  koltuğu geri kazanabilmeli. Bu, korsanlıktan daha çok destek maliyetini düşürür.
- Yeniden kurulum ve OS güncellemeleri parmak izini değiştirebilir; sunucu tarafında
  "aynı lisans, 30 gün içinde tekrar etkinleştirme" için tolerans olmalı.

### Çevrimdışı tolerans süresi

- Lisans dosyası geçerliyken **hiçbir kısıtlama yok**.
- `expiresAt` geçtikten sonra ek **7 günlük yumuşak tolerans**: uygulama çalışır, arayüzde
  kalıcı bir uyarı gösterilir.
- Tolerans da dolarsa **kademeli kısıtlama** (aşağıya bakınız).

### Saat oynatma

Saat geri alınarak `expiresAt` süresiz uzatılabilir. Uygulanabilir önlemler:

1. **Monoton zaman kaydı:** görülen en yüksek zaman damgası yerelde saklanır; sistem saati
   bunun gerisine düşerse "saat geri alınmış" sayılır ve tolerans penceresi kapatılır.
2. **Sunucu zamanı referansı:** her yenileme yanıtındaki sunucu zamanı kaydedilir.
3. **Kullanım sayacı:** tolerans süresi yalnızca takvimle değil, uygulama açılış sayısıyla da
   sınırlanır.

Bunlar bir saldırganı durdurmaz (yerel durum silinebilir); yalnızca kazara ve tembel
istismarı engeller. Belgeye böyle yazılmalıdır.

### İptal ve iadeler

| Olay | Sunucu | İstemci |
| --- | --- | --- |
| İade | Ödeme sağlayıcısı webhook'u → lisans `revoked` | Sonraki yenileme 403 → dosya silinir → kısıtlama |
| Ters ibraz | Aynı; ayrıca hesap işaretlenir | Aynı |
| Abonelik iptali | Dönem sonunda `expiresAt` uzatılmaz | Dosya doğal olarak sona erer |
| Anahtar paylaşımı tespiti | Etkinleştirme limiti + anormal cihaz döngüsü uyarısı | — |

İptal, **en fazla bir yenileme periyodu** kadar gecikmeli etki eder. Bu, B modelinin bilinçli
olarak kabul edilmiş maliyetidir.

### Doğrulama başarısız olduğunda uygulamanın davranışı

**Engelleme değil, kademeli kısıtlama.** Sıralama:

1. **Uyarı (banner):** tolerans penceresi içinde — hiçbir işlev kapanmaz.
2. **Yeni oturum açılmaz:** yeni PTY oturumu başlatılamaz; mevcut oturumlar çalışmaya devam
   eder ve normal şekilde sonlanır.
3. **Salt okunur mod:** projeler, workitem'lar, task'lar, planlar ve loglar okunabilir;
   yeni kayıt oluşturulamaz.
4. **Kullanıcı verisine her zaman erişim:** `data/` altındaki JSON dosyaları kullanıcının
   kendi verisidir. Lisans sona erse bile **hiçbir koşulda erişimi kesilmez** — aksi durum
   ürüne duyulan güveni bitirir.

Çalışan bir ajan oturumunun ortasında uygulamayı kilitlemek kabul edilemez: kullanıcı gerçek
iş kaybeder.

---

## "Başka neler yapılabilir?" — issue'nun sorduğu seçenekler

| Seçenek | Ne sağlar | Takas |
| --- | --- | --- |
| **Deneme süresi** | Satın alma öncesi değerlendirme; dönüşümü yükseltir | Sunucu tarafı kayıt gerekir; yoksa yeniden kurulumla sonsuz deneme yapılır |
| **Koltuk / cihaz limiti** | Anahtar paylaşımını sınırlar | Çok sıkı limit destek yükü ve iptal üretir; 3 cihaz makul taban |
| **Çevrimdışı tolerans penceresi** | Ağsız ortamda çalışabilme; en büyük kullanıcı deneyimi kazancı | İptal gecikmesi |
| **Telemetri / heartbeat** | Anormal kullanımı (aynı lisans, çok cihaz) görünür kılar | Gizlilik maliyeti; geliştirici kitlesi bunu sevmez — opt-in ve şeffaf olmalı |
| **Uzaktan kapatma anahtarı** | Ele geçirilmiş sürümü uzaktan devre dışı bırakır | Yanlış tetiklenirse marka hasarı; asla "kullanıcı verisine erişimi kesme" biçiminde uygulanmamalı |
| **Kademeli özellik açma** | Plan farklılaştırma; `entitlements` ile kod değişikliği gerektirmez | Ücretsiz katman, bakım maliyetini artırır |
| **Sürüm bazlı lisans** (kalıcı + 1 yıl güncelleme) | Aboneliğe direnen kitleye satış imkânı | Sunucu, hangi sürümün hangi lisansla çalışacağını bilmeli |
| **Cihaz devre dışı bırakma self-service'i** | Destek biletlerini azaltır | Küçük ek sunucu işi |

---

## Sunucu tarafı kapsamı — bu görev değil, takip issue'su

Bu görevde **hiçbir sunucu kurulmadı.** Aşağıdaki kapsam, ayrı bir issue içindir
(`feature: license service`).

**Uçlar (minimum):**

| Uç | İşlev |
| --- | --- |
| `POST /v1/activate` | anahtar + cihaz parmak izi → imzalı lisans dosyası |
| `POST /v1/renew` | mevcut lisans dosyası → yeni `expiresAt` ile imzalı dosya (200 / 403 / 204) |
| `POST /v1/deactivate` | cihazı serbest bırakır |
| `POST /v1/webhooks/payment` | satın alma / iade / ters ibraz olayları |

**Veri:** lisanslar (hash'lenmiş anahtar, plan, durum, `entitlements`), cihaz kayıtları
(parmak izi, ilk/son görülme), olay günlüğü (etkinleştirme, yenileme, iptal).

**Anahtar yönetimi:** Ed25519 özel anahtarı yalnızca sunucuda; secret manager'da saklanır ve
rotasyona uygun olmalı (uygulama birden fazla açık anahtar tanıyabilmeli, yoksa anahtar
değişimi eski sürümleri kırar).

**Nerede çalışır:** küçük bir yönetilen servis yeterli (tek bölge, düşük trafik). Kesinti
toleransı yüksek, çünkü B modelinde sunucu kritik yolda değil.

**Yap ya da satın al:** Keygen ve Cryptolens gibi hazır platformlar Ed25519/RSA imzalı
çevrimdışı lisans dosyalarını ve cihaz etkinleştirmesini doğrudan sağlıyor; Polar ve Lemon
Squeezy gibi ödeme öncelikli platformlarda ise lisans yalnızca basit bir anahtar API'si —
imzalı çevrimdışı artefakt, tolerans penceresi ve yedek mekanizma sunmuyorlar. **Öneri: ilk
sürümde hazır bir lisans platformu kullan**, kendi servisini yazma; ölçek ve maliyet
gerektirdiğinde taşı. (Fiyat ve özellik ayrıntıları **[doğrulanmadı]** — issue açılırken
güncel olarak karşılaştırılmalı.)

---

## Dürüst sınırlar

- İstemci tarafındaki her kontrol kaldırılabilir. İmza doğrulaması `true` döndüren tek satıra
  indirgenebilir; bunu engelleyen hiçbir teknik yoktur.
- Lisans sunucusu, `/etc/hosts` veya bir yerel proxy ile sahte yanıt döndürmeye zorlanabilir.
  İmza doğrulaması bunu zorlaştırır ama gömülü açık anahtar değiştirilerek aşılabilir.
- Bu nedenle lisanslama; kod imzalama, güncelleme kanalı güvenliği ve — mümkün olduğu ölçüde —
  değerli mantığın sunucuda tutulmasıyla birlikte düşünülmelidir. Ayrıntı için ana belgenin
  **Soru 3** ve **Soru 4** bölümleri.
- Ölçülebilir bir korsanlık problemi görülmeden bu alana ek yatırım yapılmamalıdır. İlk
  sürümde doğru hedef: **satın alması kolay, etkinleştirmesi kolay, çevrimdışı çalışan** bir ürün.

---

## Kaynaklar

Erişim tarihi: 2026-09-04.

- [Keygen — Çevrimdışı lisanslama / kriptografi](https://keygen.sh/docs/api/cryptography/)
- [Keygen — Çevrimdışı lisanslama modeli nasıl uygulanır](https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/)
- [Cryptolens — Kendi barındırılan lisans sunucusu](https://github.com/Cryptolens/license-server)
- [Tauri v2 — Updater eklentisi (imza zorunluluğu)](https://v2.tauri.app/plugin/updater/)
