# Masaüstü uygulaması paketleme araştırması: Tauri ve Electron

- **Tarih:** 2026-09-04
- **İlgili issue:** [#36 — uygulama electron ile masaüstü uygulaması yapılabilir mi?](https://github.com/boraaaydin/agenthub/issues/36)
- **Durum:** Karar anlık görüntüsü. Bu belge bir araştırma ve karar dokümanıdır; hiçbir ürün
  kodu üretmez. Aşağıdaki sürüm bilgileri 2026-09-04 itibarıyla doğrulanmıştır; ilerleyen
  tarihlerde tekrar doğrulanmalıdır.
- **Devam belgesi:** Lisanslama tasarımının tamamı ayrı dosyadadır →
  [`docs/research/desktop-licensing.md`](./desktop-licensing.md)

---

## Özet

AgentHub masaüstü uygulamasına dönüştürülebilir. Dört sorunun kısa cevabı:

1. **Ayrı uygulama olarak repoya eklenebilir mi?** Evet. `src/`, `server/` ve `server.ts`
   dosyalarına dokunmadan, yeni bir `desktop/` üst dizini ve `pnpm-workspace.yaml` içine
   eklenecek bir `packages:` anahtarı ile mümkündür. Repo kökünde yalnızca `package.json`
   script'leri ve `next.config.ts` (build çıktısı için) değişir.
2. **Hangi çalışma zamanı?** **Tauri 2** öneriliyor. Electron ile de yapılabilir — teknik
   olarak *daha kolay* bile yapılabilir — ancak dağıtım boyutu, bellek tüketimi ve "zaten ağır
   geliştirici makinesine ikinci bir Chromium kurmama" gerekçesiyle karar Tauri yönünde.
   Bunun bedeli açıktır: Rust araç zinciri, Node sidecar mimarisi ve ekipte hiç kullanılmayan
   yeni bir yığın.
3. **Lisanslama?** Bu görevin uygulama kapsamı dışında; tasarım
   [`desktop-licensing.md`](./desktop-licensing.md) belgesinde. Öneri: **Ed25519 ile imzalı
   çevrimdışı lisans dosyası + periyodik çevrimiçi yenileme**, cihaz bağlama ve ~14 günlük
   çevrimdışı tolerans penceresiyle.
4. **Kaynak kod kopyalanması engellenebilir mi?** **Hayır.** Yalnızca zorlaştırılabilir.
   Makinenin sahibi olan yetkin bir saldırganın paketten JavaScript'i çıkarması engellenemez.
   Gerçekçi hedef: sıradan kopyalamayı caydırmak + değeri olan mantığı sunucuya taşımak.

**Bir cümlelik öneri:** Önce mevcut kod tabanını paketlenebilir hale getiren ön koşulları
(veri kökü, tsx'siz üretim başlatma, dinamik port) kapat; ardından Tauri 2 + Node sidecar ile
zaman kutulu bir spike aç; lisanslama ve imzalamayı ayrı issue'lara böl.

> **Ürün duruşu değişikliği uyarısı.** `.agent/PROJECT_DOCUMENT.md` bugün AgentHub'ı açıkça
> *"locally-run … not intended to be deployed publicly"* diye tanımlıyor. Ücretli, lisanslı bir
> masaüstü ürünü bu duruşun değişmesidir: dağıtım, imzalama, güncelleme, destek ve lisans
> sunucusu gibi kalıcı işletme yükleri doğurur. Bu belge teknik fizibiliteyi yanıtlar; ürün
> kararını değil.

---

## Kapsam ve yöntem

- Kaynak kod değiştirilmedi. Hiçbir araç kurulmadı (`create-tauri-app`, `electron-forge`,
  `pnpm add` çalıştırılmadı).
- Doğrulanan sürümler (2026-09-04): `@tauri-apps/cli` **2.11.4**, `electron` **44.2.0**,
  `electron-builder` **26.15.3**, `node-pty` **1.1.0** (npm'deki en güncel sürüm), yerel Node
  **v26.8.1**, repo Next.js **16.3.4**.
- Next.js iddiaları, tahmin yerine repodaki `node_modules/next/dist/docs/` altındaki 16.3.4
  dokümantasyonundan okundu.
- node-pty iddiaları, kurulu paketin (`node_modules/node-pty/`) kaynağından doğrulandı.
- Kurulum gerektirdiği için doğrulanamayan iddialar metin içinde **[doğrulanmadı]** olarak
  işaretlenmiştir ve neyin doğrulayacağı yazılmıştır.

---

## Paketlenen şey nedir?

Paketlenecek şey statik bir frontend değil. Mimarinin masaüstü kabuğuna dayattığı kısıtlar:

| Bileşen | Dosya | Paketleme açısından anlamı |
| --- | --- | --- |
| Özel Node sunucusu | `server.ts` | Next.js (`next({ dev })` + `getRequestHandler`) **ve** `ws` `WebSocketServer` aynı portta. `tsx` ile başlatılıyor; bugün standalone build yok. |
| PTY oturum kaydı | `server/session-registry.ts` | Oturumlar bellekte. Kabuk, uzaktaki bir siteyi gösteren ince bir webview olamaz — süreçler kullanıcının makinesinde doğmak zorunda. |
| Yerel modül | `node-pty` 1.1.0 | Native `.node` binary + `spawn-helper` çalıştırılabiliri. Bu görevdeki en büyük paketleme riski. |
| Veri katmanı | `src/lib/*-store.ts` | Tümü çalışma dizinine göre `data/*.json` okuyup yazıyor. Paketlenmiş uygulamada çalışma dizini repo değildir. |
| Yerleşik prompt'lar | `src/lib/default-settings-prompts.ts` | Çalışma dizinine göre `src/lib/default-prompts/` altından Markdown okuyor — pakette bu yol yoktur. |
| Çalışma alanı | `pnpm-workspace.yaml` | `packages:` anahtarı **yok**; repo tek paketli bir pnpm workspace'i. |

### Belirleyici `node-pty` gerçekleri

Kurulu paketten doğrulananlar (node-pty 1.1.0):

- **Node-API tabanlı.** Tek çalışma zamanı bağımlılığı `node-addon-api ^7.1.0`. Node-API, ABI
  kararlıdır: aynı `.node` dosyası hem Node hem Electron altında çalışabilir; klasik
  `electron-rebuild` zorunluluğu bu nedenle büyük ölçüde ortadan kalkar. **[doğrulanmadı]** —
  bunu kesinleştirmek için Electron 44 altında bir smoke test gerekir.
- **Prebuild kapsamı eksik.** `node_modules/node-pty/prebuilds/` içinde yalnızca
  `darwin-arm64`, `darwin-x64`, `win32-arm64`, `win32-x64` var. **Linux prebuild yok** →
  Linux'ta `node scripts/prebuild.js || node-gyp rebuild` ile kaynaktan derleniyor. Yani Linux
  dağıtımı, Linux üzerinde derleme yapan bir CI iş akışı gerektirir; çapraz derleme yoktur.
- **Binary diskte gerçek dosya olmak zorunda.** `lib/utils.js` yüklemeyi `build/Release`,
  `build/Debug`, `prebuilds/{platform}-{arch}` sırasıyla yapıyor; `.node` dosyaları `dlopen()`
  ile açıldığı için arşiv içinden yüklenemez.
- **Electron farkındalığı pakete gömülü.** `lib/unixTerminal.js` içinde birebir şu satır var:
  `helperPath = helperPath.replace('app.asar', 'app.asar.unpacked');`. node-pty, Electron'un
  asar düzenini tanıyor. Tauri için böyle hazır bir davranış yok — sidecar tarafında yolları
  biz çözmek zorundayız.
- `scripts/ensure-node-pty.mjs` kurulum sonrası `spawn-helper` dosyasını `chmod 0o755` yapıyor.
  Paketleyicinin **çalıştırma iznini koruması** şart; aksi halde macOS/Linux'ta PTY açılmaz.

**Sonuç:** Karşılaştırma boyutla değil, bununla başlar. Gerçek bir PTY açamayan hiçbir seçenek
aday değildir. Bu, tarayıcı tabanlı kabukları (PWA, yalnızca webview saran paketleyiciler) ve
saf web dağıtımını doğrudan eler.

---

## Soru 1 — Aynı repoda ayrı bir masaüstü uygulaması

**Evet, mümkün.** `src/`, `server/` ve `server.ts` dosyalarına dokunulmadan yapılabilir.

### Önerilen yerleşim

```
agenthub/
├── src/                    # değişmez — mevcut web uygulaması
├── server/                 # değişmez
├── server.ts               # değişmez
├── desktop/                # YENİ — masaüstü kabuğu, ayrı bir pnpm paketi
│   ├── package.json        # name: "@agenthub/desktop", private: true
│   ├── src-tauri/
│   │   ├── tauri.conf.json # bundle.externalBin, updater, capabilities
│   │   ├── Cargo.toml
│   │   ├── capabilities/default.json
│   │   ├── binaries/       # target-triple ekli sidecar çalıştırılabilirleri
│   │   └── src/main.rs     # sidecar'ı başlat, portu oku, pencereyi yönlendir
│   ├── scripts/
│   │   ├── build-server.mjs   # web app build çıktısını sidecar yüküne dönüştürür
│   │   └── stage-native.mjs   # node-pty prebuild + spawn-helper yerleştirme
│   └── README.md
└── docs/research/          # YENİ — bu belge
```

### Gerekli repo kökü değişiklikleri

Kaynak kod değişmez, ancak kökte üç dosyaya dokunulur:

| Dosya | Değişiklik | Zorunlu mu? |
| --- | --- | --- |
| `pnpm-workspace.yaml` | `packages: [".", "desktop"]` eklenir. Mevcut `ignoredBuiltDependencies` korunur. | Evet — mekanizmanın kendisi bu. |
| `package.json` (kök) | `desktop:dev` / `desktop:build` script'leri. Bağımlılık eklenmez. | Hayır, kolaylık. `pnpm --filter` ile de çalıştırılabilir. |
| `next.config.ts` | Paketlenebilir çıktı için `output: "standalone"` (aşağıya bakınız). | Evet — build sorunu bunsuz çözülmüyor. |

> **Bu görevde bunların hiçbiri yapılmadı.** Yukarıdaki tablo, açılacak issue'nun kapsamıdır.

Ayrıca `.gitignore` içine `desktop/src-tauri/target/` ve `desktop/src-tauri/binaries/`
eklenmelidir.

### Masaüstü uygulamasının web uygulamasını tüketme biçimi

Masaüstü uygulaması web uygulamasını **kopyalamaz, tüketir**:

1. Kök pakette `next build` çalışır → `.next/` (ve `output: "standalone"` ile
   `.next/standalone/`) üretilir.
2. `desktop/scripts/build-server.mjs`, bu çıktıyı + derlenmiş özel sunucuyu + `node_modules`
   izini `desktop/src-tauri/binaries/` altına bir "sunucu yükü" olarak taşır.
3. Tauri kabuğu bu yükü **sidecar** olarak çalıştırır: ayrı bir Node süreci, `127.0.0.1`
   üzerinde rastgele bir portta dinler.
4. Tauri penceresi `http://127.0.0.1:{port}` adresine yönlendirilir. Tarayıcı tarafı kodda
   hiçbir değişiklik gerekmez: `use-agent-socket.ts` WebSocket adresini zaten
   `${protocol}//${window.location.host}/api/agent-socket` ile üretiyor ve bu, pencere yerel
   sunucuyu yüklediği sürece doğru çalışır.

Kod tekrarı yoktur; `desktop/` yalnızca kabuk, süreç yönetimi ve paketleme betikleri içerir.

### Ortak build sorunu: `next build` yeterli değil

Bugün `pnpm build` yalnızca `next build`. Bu, paketlenebilir bir çıktı üretmez çünkü:

- Üretimde `pnpm start` = `NODE_ENV=production tsx server.ts`. Yani üretim yolu **TypeScript
  kaynağına, `tsx`'e ve repo checkout'una bağımlı**. Paketlenmiş bir uygulamada bunların üçü
  de yok.
- Next.js 16.3.4 dokümantasyonu (`node_modules/next/dist/docs/01-app/02-guides/custom-server.md`)
  açıkça şunu söylüyor: *"When using standalone output mode, it does not trace custom server
  files. This mode outputs a separate minimal `server.js` file, instead. These cannot be used
  together."*

Yani `output: "standalone"` bizim `server.ts` dosyamızı **izlemez**. Uygulanabilir yol şudur:

1. `next.config.ts` içinde `output: "standalone"` açılır → `.next/standalone/` altında
   `node_modules` izi çıkarılır (Next runtime dahil).
2. `server.ts`, esbuild/tsup ile ayrıca tek bir dosyaya derlenir; `next`, `ws` ve `node-pty`
   **external** bırakılır (bunlar `.next/standalone/node_modules` içinden çözülecektir).
3. Next.js'in ürettiği minimal `server.js` **kullanılmaz**; bizim derlenmiş sunucumuz
   `.next/standalone/` kökünde, `dir` ve çalışma dizini doğru ayarlanarak çalıştırılır.
4. `public/` ve `.next/static/` klasörleri, dokümanın belirttiği gibi elle
   `.next/standalone/` altına kopyalanır.
5. `node-pty` `prebuilds/{platform}-{arch}/` + `spawn-helper` dosyaları, izleme bunları
   kaçırabileceği için **elle** yerleştirilir ve çalıştırma izni korunur.

Bu adımların bütünü **[doğrulanmadı]**; bir spike ile kanıtlanmalıdır. Doğrulama kriteri:
repo dizini dışında, `tsx` kurulu olmayan temiz bir makinede paketlenmiş sunucunun ayağa
kalkması ve bir PTY oturumu açabilmesi.

---

## Çalışma zamanı karşılaştırması — Tauri ve Electron

### Karşılaştırma tablosu

Sıralama önem sırasına göre; boyut en sonda.

| Kriter | Tauri 2 (2.11.4) | Electron (44.2.0) |
| --- | --- | --- |
| **`node-pty` desteği** | Doğrudan değil. Node bir **sidecar** süreç olarak paketlenir; `node-pty` orada çalışır. Yol/izin/prebuild yerleşimini biz yönetiriz. | Birinci sınıf. Node-API prebuild'leri `asar.unpack` ile `app.asar.unpacked/` altına açılır; node-pty kodunda asar farkındalığı **zaten var**. |
| **Node sunucusunun barındırılması** | Ayrı süreç (sidecar). Node runtime'ı ayrıca paketlenmeli. | Doğal. Ana süreç veya `UtilityProcess` içinde çalışır; Node zaten gömülü. |
| **Web katmanı (xterm.js)** | İşletim sistemi webview'ı: WebView2 (Windows), WKWebView (macOS), **WebKitGTK (Linux)**. Linux'ta bilinen kararlılık/performans sorunları. | Her platformda aynı Chromium. Render davranışı tekdüze. |
| **Build/CI karmaşıklığı** | Yüksek. Rust araç zinciri + platform başına runner + sidecar üretimi. Çapraz derleme pratikte yok. | Orta. `electron-builder` olgun; yine de platform başına runner gerekir (node-pty Linux prebuild'i yok). |
| **Kod imzalama / notarization** | Destekli; imzalama yükü aynı (Apple Developer ID + `notarytool`, Windows Authenticode). | Destekli; `electron-builder` içinde imzalama ve notarization akışları hazır. |
| **Otomatik güncelleme** | Yerleşik updater plugin'i. İmza **zorunlu** ve kapatılamaz (Ed25519 anahtar çifti). Statik JSON manifest veya dinamik sunucu (200/204). **Tam binary** değişimi; delta yok. Windows MSI+NSIS, macOS `.app.tar.gz`, Linux AppImage/`.tar.gz`. | `electron-updater` fiili standart; delta ve kademeli yayın gibi olgun özellikler. |
| **Sertleştirme / kurcalamaya karşı araçlar** | Rust tarafı derlenmiş; ama JS yükü sidecar'da düz dosya. Hazır bir "fuse" mekanizması yok. | `Electron Fuses` (`runAsNode`, `enableNodeCliInspectArguments`, `embeddedAsarIntegrityValidation`, `onlyLoadAppFromAsar`) hazır bir sertleştirme yüzeyi sunar. |
| **Ekip aşinalığı** | **Sıfır.** Repoda Rust yok, kimse kullanmıyor. | Node/TS ekosistemi; mevcut bilgiyle örtüşüyor. |
| **Bellek** | Kabuk hafif; ancak Node sidecar + sistem webview toplamı, tek başına Tauri rakamlarından yüksek olur. | Chromium + Node; belirgin şekilde daha ağır. |
| **Dağıtım boyutu** | Kabuk 2–10 MB, **ama** Node runtime (~50–60 MB) + Next.js standalone çıktısı eklenince fark ciddi biçimde kapanır. Gerçekçi beklenti: ~70–110 MB. | ~80–200 MB. Gerçekçi beklenti: ~150–200 MB. |

### Electron ile yapılabilir mi? — Evet

Issue'nun literal sorusuna net cevap: **Evet, Electron ile yapılabilir ve bugün en düşük
riskli yol da budur.** Gerekçeler:

- `node-pty` 1.1.0 Node-API tabanlı; Electron altında ek derleme gerektirmeden çalışması
  bekleniyor. Paketin kendi kaynağında `app.asar` → `app.asar.unpacked` yol düzeltmesi hazır.
- `@electron-forge/plugin-auto-unpack-natives` (ya da `electron-builder`'ın `asarUnpack`
  ayarı) `**/*.node` dosyalarını otomatik olarak arşiv dışına çıkarır.
- Node runtime'ı ayrıca paketlemek gerekmez; Next.js sunucusu `UtilityProcess` ya da ana
  süreçte çalışır. `tsx` bağımlılığından kurtulmak yine de gerekir, ama sidecar/port
  el sıkışması ve Node dağıtımı sorunları hiç doğmaz.
- Sertleştirme yüzeyi hazırdır (fuses, asar integrity) ve `electron-updater` olgundur.

### Önerinin yine de neden Tauri olduğu

Karar, planlama sırasında kullanıcıyla birlikte verildi; bu belge onun üzerine yazıldı.
Gerekçeler:

1. **Hedef kitle geliştirici.** AgentHub kullanıcısı makinesinde zaten VS Code, tarayıcı ve
   birden çok CLI ajanı çalıştırıyor. Ürüne ikinci bir Chromium daha eklemek, tam da bu
   kitlenin en çok şikâyet ettiği maliyet.
2. **Kabuk gerçekten ince.** Uygulama zaten bir HTTP sunucusu + tarayıcı arayüzü. Kabuktan
   beklenen tek şey: sunucuyu başlat, pencereyi aç, kapanışta süreçleri temizle. Electron'un
   sunduğu zengin ana-süreç API yüzeyi burada kullanılmıyor — yani Electron'un asıl avantajı
   bu üründe büyük ölçüde boşa gidiyor.
3. **Boyut ve bellek, ücretli bir üründe pazarlanabilir bir fark.** Kapanan farka rağmen
   (bkz. tablo) Tauri tarafı hâlâ daha küçük ve daha az bellek tüketiyor.
4. **Koruma açısından fark yok.** Dördüncü soruya verilen cevap her iki runtime için de aynı:
   JavaScript yükü çıkarılabilir. Bu yüzden koruma, seçimde belirleyici değil.

**Dürüst olmak gerekirse:** Tauri kararı mühendislik kolaylığı değil, ürün kararıdır. Teknik
risk Electron'da daha düşüktür ve bu belge bunu gizlemez.

### Bu proje için Tauri sidecar yaklaşımı

Tauri 2'de harici çalıştırılabilirler `bundle.externalBin` ile tanımlanır:

```json
{
  "bundle": {
    "externalBin": ["binaries/agenthub-server"]
  }
}
```

- Yollar `src-tauri` dizinine görelidir.
- Her binary **target triple** son ekiyle bulunmalıdır:
  `agenthub-server-aarch64-apple-darwin`, `agenthub-server-x86_64-pc-windows-msvc`,
  `agenthub-server-x86_64-unknown-linux-gnu` … (`rustc --print host-tuple`).
- İzin, `src-tauri/capabilities/default.json` içinde açıkça verilir:

```json
{
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [{ "name": "binaries/agenthub-server", "sidecar": true }]
    }
  ]
}
```

- Rust tarafında `tauri_plugin_shell::ShellExt` ile başlatılır:
  `let (mut rx, mut child) = app.shell().sidecar("agenthub-server")?.spawn()?;`

**AgentHub'a özel akış:**

1. Kabuk açılır, sidecar'ı boş port seçimi ve `AGENTHUB_DATA_DIR=<app data>` ortam
   değişkeniyle başlatır.
2. Sidecar dinlemeye başlayınca stdout'a tek satır yazar (örn. `AGENTHUB_READY {"port":51423}`).
3. Kabuk bu satırı `rx` üzerinden okur, pencereyi `http://127.0.0.1:51423` adresine yönlendirir.
4. Pencere kapanınca kabuk sidecar'ı sonlandırır; sidecar mevcut `SIGTERM` işleyicisiyle
   (`server.ts` içindeki `shutdown()`) PTY çocuklarını temizler.

### Tauri yolunun somut riskleri

| Risk | Neden ciddi | Azaltma |
| --- | --- | --- |
| **Node runtime'ının paketlenmesi** | Tauri Node içermez. Ya Node binary'si kaynak olarak gömülecek ya da tek dosya binary üretilecek. Node SEA hâlâ *Stability 1.1 – Active development*; native addon'lar `getRawAsset` ile geçici dizine yazılıp `process.dlopen` ile açılmak zorunda; macOS'ta yalnızca arm64 test ediliyor, x64 desteklenmiyor; `useCodeCache` açıkken `import()` çalışmıyor. Next.js sunucusu için bu kombinasyon riskli. | En güvenli varsayılan: **Node binary'sini olduğu gibi resource olarak paketle**, sidecar `node server.js` çalıştırsın. SEA / `bun build --compile` sonraki optimizasyona bırakılsın. |
| **Platform başına `node-pty` binary'leri** | Linux prebuild'i **yok**; her platform kendi runner'ında derlenmeli. `spawn-helper` çalıştırma izni kaybolursa PTY açılmaz. | Platform başına CI runner + paketleme sonrası "PTY açılıyor mu" smoke testi. |
| **IPC / port el sıkışması** | Sabit 3000 portu doluysa uygulama açılmaz; hazır-olma satırı kaçırılırsa pencere boş kalır. | Dinamik port + zaman aşımlı, açık protokollü hazır-olma sinyali + kullanıcıya gösterilen hata ekranı. |
| **Linux WebKitGTK** | xterm.js yoğun DOM/canvas kullanıyor. WebKitGTK'da bilinen render ve performans sorunları var (özellikle NVIDIA sürücüleriyle boş pencere/bulanıklık raporları). | İlk sürümde Linux'u kapsam dışı bırak ya da spike'ta xterm.js'i WebKitGTK üzerinde ölç. |
| **CI'da Rust araç zinciri** | Build süresi ve bakım yükü artar; `target/` önbelleği gerekir. | GitHub Actions matrix + Rust derleme önbelleği. |
| **Ekipte Rust bilgisi yok** | Kabuk kodu küçük olsa da hata ayıklama, imzalama ve updater sorunları Rust tarafında çıkar. | Kabuğu kasıtlı olarak minimum tut: sidecar başlat, port oku, pencere aç, kapat. İş mantığı Rust'a taşınmasın. |

### Öneriyi Electron'a geri döndürecek durumlar

Aşağıdakilerden **herhangi biri** gerçekleşirse karar Electron'a döner:

- Spike'ta Node sidecar + `node-pty` üçlemesi (macOS/Windows/Linux) zaman kutusu içinde
  çalışır hale gelmezse.
- xterm.js WebKitGTK üzerinde kabul edilemez performans/render sorunu gösterirse ve Linux
  desteği zorunluysa.
- Ürün, gerçek bir masaüstü entegrasyonu isterse (derin OS entegrasyonu, tray, global
  kısayollar, çoklu pencere yönetimi, güncellemede delta zorunluluğu).
- Rust bakımına ayıracak kapasite bulunamazsa.
- Electron'un sertleştirme yüzeyi (fuses + asar integrity) lisanslama gereksinimi için
  belirleyici görülürse.

---

## Soru 2 — Lisanslama

Tasarımın tamamı ayrı belgededir: **[`docs/research/desktop-licensing.md`](./desktop-licensing.md)**

Oradaki sonucun özeti:

- **Öneri:** Ed25519 ile imzalı **çevrimdışı lisans dosyası** + periyodik **çevrimiçi
  yenileme** (saf "her açılışta sunucuya sor" modeli değil).
- Satın alma → anahtar üretimi → etkinleştirme → periyodik yeniden doğrulama akışı uçtan uca
  tanımlandı; cihaz bağlama, etkinleştirme limiti, ~14 günlük çevrimdışı tolerans, saat
  oynatmaya karşı monoton zaman kontrolü, iptal ve iade akışları dahil.
- Doğrulama başarısız olduğunda davranış: **engelleme değil, kademeli kısıtlama** (yeni oturum
  açılmaz, veriye erişim korunur).
- Sunucu tarafı (düzenleme + doğrulama uçları, anahtar saklama, barındırma) bu görevin değil,
  **ayrı bir issue'nun** kapsamıdır.
- İstemci tarafı lisans kontrolleri kararlı bir saldırgan tarafından **kaldırılabilir**;
  amaç sürtünme + dürüst müşteri için pürüzsüz deneyimdir.

---

## Soru 3 — Kurcalamaya karşı önlemler

Her satır, **makinenin sahibi olan yetkin bir saldırgana** karşı derecelendirilmiştir.
"Etki" sütunu, o saldırgana karşı gerçek değeri gösterir.

| Önlem | Ne yapar | Neyi durdurur | Neyi durdurmaz | Etki | Maliyet |
| --- | --- | --- | --- | --- | --- |
| **macOS kod imzalama + notarization** (Developer ID Application, hardened runtime, `notarytool submit --wait`, staple) | Binary'nin kaynağını ve bütünlüğünü işletim sistemine kanıtlar | Gatekeeper uyarısı; değiştirilmiş kopyanın imzasız kalması; sessiz truva atı dağıtımı | Saldırganın imzayı söküp kendi kopyasını yerelde çalıştırmasını | **Yüksek** (dağıtım için zaten zorunlu) | Apple Developer Program ~$99/yıl + CI'da imzalama |
| **Windows Authenticode** (OV/EV sertifika veya Azure Trusted/Artifact Signing) | Aynı işlevin Windows karşılığı; SmartScreen itibarı | "Bilinmeyen yayıncı" uyarısı; değiştirilmiş installer'ın imzasız kalması | Yerel olarak yamanmış kopyayı | **Yüksek** | OV ~$150–300/yıl, EV ~$400+/yıl; Azure Trusted Signing Basic ~$9.99/ay (5.000 imza). Uygunluk şartları (kuruluş yaşı vb.) **[doğrulanmadı]** |
| **Electron Fuses** (`runAsNode`, `enableNodeCliInspectArguments` kapalı) | Uygulamanın genel amaçlı Node süreci gibi yeniden başlatılmasını engeller | `ELECTRON_RUN_AS_NODE` ile uygulamanın TCC/sandbox izinlerinin devralınmasını; `--inspect` ile kolay debug | Kararlı tersine mühendisliği | **Orta** (yalnızca Electron seçilirse) | Düşük — ama meşru bir yardımcı Node sürecine ihtiyaç varsa `UtilityProcess`'e geçmek gerekir |
| **Asar bütünlüğü** (`embeddedAsarIntegrityValidation` + `onlyLoadAppFromAsar`) | Yükleme anında `app.asar` içeriğini doğrular | Paketlenmiş dosyaların yerinde düzenlenmesini | İmzayı yeniden hesaplayan saldırganı. Ayrıca **CVE-2025-55305** ile resource klasörü üzerinden bypass edilebiliyordu (35.7.5 / 36.8.1 / 37.3.1 / 38.0.0-beta.6 ile giderildi) | **Düşük–Orta** | Düşük; Electron sürümünü güncel tutmak zorunlu |
| **Uygulama paketinin kendi bütünlük kontrolü** (kendi hash doğrulaması) | Çalışma anında dosya hash'lerini kontrol eder | Amatör yamalamayı | Kontrolün kendisinin devre dışı bırakılmasını — kontrol, koruduğu ikili dosyanın içindedir | **Düşük** | Orta; yanlış pozitifler destek yükü yaratır |
| **Sunucu tarafı doğrulama** (değerli her şey uzakta) | Kritik mantığı saldırganın erişemeyeceği yere taşır | Gerçekten her şeyi — çalınamayan şey kopyalanamaz | Kullanıcının çevrimdışı çalışmasını; ürün duruşuyla çelişir | **Çok yüksek** — tek gerçek önlem | Yüksek: mimari değişikliği + işletme yükü |
| **Obfuscation / minification** | Okunabilirliği düşürür | Kopyala-yapıştır seviyesindeki incelemeyi | Deobfuscator + debugger kullanan hiç kimseyi | **Çok düşük** | Düşük para, yüksek hata ayıklama maliyeti (stack trace'ler bozulur) |
| **Anti-debug kontrolleri** (debugger tespiti, zamanlama kontrolü) | Ekleme/inceleme girişimini zorlaştırır | Sıradan meraklıyı | Hiçbir ciddi saldırganı; ayrıca antivirüs yanlış pozitiflerini tetikler | **Çok düşük** | Orta — ve dürüst kullanıcıya zarar verme riski |
| **Güvenli güncelleme kanalı** (imzalı güncellemeler; Tauri updater imzayı **zorunlu** kılar) | Güncelleme yolunun ele geçirilmesini engeller | Sahte/zehirli güncelleme paketlerini | Kullanıcının güncellemeyi hiç yapmamasını | **Yüksek** | Düşük–orta; **özel anahtar kaybedilirse yeni güncelleme yayınlanamaz** |

**Öncelik sırası:** kod imzalama + notarization → imzalı güncelleme kanalı → sunucu tarafı
doğrulama → (Electron seçilirse) fuses + asar integrity. Obfuscation ve anti-debug, listenin
en altındadır ve kendi başlarına yatırım yapılmaya değmez.

---

## Soru 4 — Kaynak kodun korunması

Üç yöntem ayrı ayrı değerlendirildi. Hiçbiri diğerinin yerine geçmez.

### (a) Bundle paketleme + küçültme (asar / gömülü varlıklar)

- **Ne yapar:** Uygulama dosyalarını tek bir arşivde toplar (Electron'da `app.asar`; Tauri'de
  frontend varlıkları binary'ye gömülür, Node yükü ise sidecar'ın yanında düz dosya kalır).
  Küçültme isimleri kısaltır, yorumları siler.
- **Efor:** Düşük. Paketleyicinin varsayılan davranışı.
- **Build/debug maliyeti:** Düşük; source map'ler kapatılırsa hata ayıklama zorlaşır.
- **Nasıl kırılır:** `npx asar extract app.asar out/` — tek komut. Arşiv **şifreli değildir**;
  Electron dokümantasyonu bunu kaynak kodu *yüzeysel incelemeden* gizlemek olarak tarif eder.
  Küçültme geri alınamaz ama çıktıyı okunabilir hale getirmek rutin bir iştir.
- **Değerlendirme:** **Caydırıcıdır, koruma değildir.** Yine de yapılmalıdır — bedava,
  yükleme süresini iyileştirir ve dosya yolu sorunlarını azaltır. Ancak "korunuyoruz" cümlesi
  buna dayandırılmamalıdır. Ek olarak `node-pty` gibi native modüllerin arşiv **dışında**
  kalması zorunlu olduğundan, arşiv hiçbir zaman bütünü kapsamaz.

### (b) V8 bytecode derlemesi / derlenmiş tek dosya binary

- **Ne yapar:** İki farklı seçenek var:
  - **`bytenode` / V8 bytecode:** `.js` yerine `.jsc` dosyaları gönderilir; kaynak metin
    pakette bulunmaz.
  - **Derlenmiş tek dosya binary:** Node SEA (`--build-sea`, Node ≥ v25.5.0) veya
    `bun build --compile`; sidecar tek çalıştırılabilir hale gelir.
- **Efor:** bytenode için orta; SEA için yüksek (aşağıya bakınız).
- **Build/debug maliyeti:**
  - Bytecode **V8/Node sürümüne sıkı bağlıdır**: `.jsc`, üretildiği V8 sürümüyle uyumlu bir
    runtime ister. Node/Electron yükseltmesi tüm yükün yeniden derlenmesi demektir. Apple
    Silicon üzerinde bytecode ile ilgili çökme raporları mevcut.
  - Stack trace'ler kullanışsızlaşır; üretim hatalarını teşhis etmek belirgin şekilde zorlaşır.
  - Node SEA'nın belgelenmiş kısıtları ciddidir: *Stability 1.1 – Active development*;
    varsayılan olarak yalnızca yerleşik modüller `require` edilebilir; `import()` dosya
    sisteminden yükleyemez; `useCodeCache` açıkken `import()` çalışmaz; çapraz platform
    üretimde `useCodeCache` ve `useSnapshot` kapalı olmalıdır; macOS'ta yalnızca arm64 test
    ediliyor (x64 desteklenmiyor); native addon'lar `getRawAsset` ile geçici dizine yazılıp
    `process.dlopen` ile açılmalıdır. Next.js sunucusu + `node-pty` bu kısıtların hepsine aynı
    anda çarpar.
- **Nasıl kırılır:** V8 bytecode **decompile edilebilir**. Piyasada bunu yapan araçlar var ve
  çıktı; kontrol akışını, string literal'leri ve fonksiyon yapısını büyük ölçüde koruyor.
  Bazı araç dokümantasyonlarındaki "kaynak kod kurtarılamaz" iddiası **yanlıştır**.
  SEA / `--compile` binary'lerinden de JS yükü çıkarılabilir; bu, C kodunu derlemeye benzer —
  okumak zorlaşır, imkânsızlaşmaz.
- **Değerlendirme:** Çıtayı (a) seçeneğinin belirgin üzerine taşır, ama **koruma sağlamaz**.
  AgentHub için asıl sorun maliyet tarafında: Next.js sunucusunu bytecode'a çevirmek veya
  SEA'ya sokmak, mevcut riskleri (sidecar, native modül, sürüm bağımlılığı) katlar.
  **Öneri: ilk sürümde yapılmasın.** Node sidecar'ı olduğu gibi paketle; bu yöntemi ancak
  ölçülebilir bir korsanlık problemi ortaya çıkarsa gündeme al.

### (c) Değerli mantığın sunucu tarafında tutulması

- **Ne yapar:** Kopyalanması istenmeyen mantığı istemciden çıkarır: lisans doğrulama, prompt
  kompozisyonu, plan/task iş akışı kuralları, varsa özel model çağrıları.
- **Efor:** Yüksek — mimari değişikliği, API tasarımı, işletme yükü, gecikme yönetimi.
- **Build/debug maliyeti:** Orta; ama sürekli çalışan bir servisin bakımı doğar.
- **Nasıl kırılır:** Kırılmaz — yalnızca **davranışı** gözlemlenebilir. Saldırgan girdileri ve
  çıktıları görür, kodu görmez. Kapalı kalma süresi ve gizlilik endişeleri bu seçeneğin gerçek
  bedelidir.
- **Değerlendirme:** **Tek gerçekten etkili seçenek.** Ancak AgentHub'ın "yerel çalışır"
  vaadiyle kısmen çelişir: ürünün ana değeri, kullanıcının kendi makinesindeki CLI ajanlarını
  kendi dosyaları üzerinde çalıştırması. PTY, dosya sistemi ve ajan süreçleri **zorunlu olarak**
  yereldir. Uygulanabilir orta yol: **yalnızca lisans/yetkilendirme ve — istenirse — prompt
  şablonlarının sunucudan alınması**; ajan yürütme yerelde kalır.

### Issue sorusuna doğrudan yanıt

> *"uygulamanın kaynak kodunun kopyalanmaması sağlanabilir mi elektron yapıldığında?"*

**Hayır.** Ne Electron'da ne Tauri'de sağlanabilir. Kullanıcının makinesinde çalışan kod,
o kullanıcı tarafından okunabilir; hedef kitle geliştirici olduğu için de bu, teorik değil
pratik bir gerçektir. Yapılabilecek tek şey, kopyalamayı **daha pahalı** hale getirmektir.

**Gerçekçi taban (ilk sürüm için önerilen):**

1. Paketleme + küçültme, source map'ler yayınlanmaz — bedava caydırıcılık.
2. Kod imzalama + notarization — değiştirilmiş kopyaları imzasız bırakır.
3. İmzalı güncelleme kanalı — dağıtım yolunu korur.
4. Lisans doğrulaması sunucu tarafında; istemci kontrolü yalnızca kolaylık katmanı.
5. Bytecode / obfuscation **yok** — maliyeti faydasından yüksek.

---

## Mevcut kod tabanındaki ön koşullar

Masaüstü paketlemesi başlamadan önce kapatılması gereken açıklar. Hiçbiri bu görevde
uygulanmadı.

| # | Ön koşul | Bugünkü durum | Neden zorunlu |
| --- | --- | --- | --- |
| 1 | **Yapılandırılabilir veri kökü** | `projects-store.ts`, `applications-store.ts`, `tasks-store.ts`, `workitems-store.ts`, `lifecycle-log-store.ts`, `settings-store.ts` ve `data-migration.ts` — hepsi çalışma dizinine göre `data/` altını kullanıyor | Paketlenmiş uygulamada çalışma dizini repo değildir; uygulama dizini genelde salt okunurdur. Veri işletim sistemine özgü konuma taşınmalı: macOS `~/Library/Application Support/AgentHub`, Windows `%APPDATA%\AgentHub`, Linux `$XDG_DATA_HOME/agenthub` — bir `AGENTHUB_DATA_DIR` değişkeniyle geçersiz kılınabilir |
| 2 | **Yerleşik prompt dosyalarının çözümlenmesi** | `default-settings-prompts.ts`, çalışma dizinine göre `src/lib/default-prompts/` altından Markdown okuyor | Bu yol pakette yok. Prompt'lar build'e gömülmeli veya paketlenmiş bir resource yolundan okunmalı |
| 3 | **`tsx`'siz üretim başlatma yolu** | `pnpm start` = `NODE_ENV=production tsx server.ts` | Paketlenmiş uygulamada `tsx` ve TypeScript kaynağı bulunmaz. `server.ts` önceden derlenmeli (bkz. "Ortak build sorunu") |
| 4 | **Paketlenebilir build çıktısı** | `pnpm build` = yalnızca `next build` | `output: "standalone"` + özel sunucunun elle birleştirilmesi gerekiyor; Next 16.3.4 dokümantasyonu ikisinin birlikte kullanılamayacağını yazıyor |
| 5 | **Dinamik port seçimi** | `server.ts` portu `PORT` ortam değişkeninden okuyor, yoksa 3000 kullanıyor | 3000 doluysa uygulama açılmaz. Boş port seçimi + kabuğa bildirilen hazır-olma sinyali gerekir |
| 6 | **WebSocket adresinin çözümü** | `use-agent-socket.ts` ve `workitem-live-updates.tsx`: `${protocol}//${window.location.host}/api/agent-socket` | Pencere `http://127.0.0.1:{port}` yüklediği sürece **çalışır**; ancak `tauri://localhost` gibi özel bir şema kullanılırsa `window.location.host` yanlış olur. Kabuk mutlaka yerel HTTP adresine yönlendirmeli, yoksa adres yapılandırılabilir olmalı |
| 7 | **Alt süreçler için `PATH`** | PTY'ler `claude` / `codex` / `pi` komutlarını `PATH`'ten çözüyor | Finder/Explorer'dan açılan GUI uygulamaları login shell `PATH`'ini devralmaz; paketlenmiş uygulamada ajanlar "bulunamadı" hatası verir. Kabuğun login shell ortamını çözmesi ya da kullanıcıya yapılandırılabilir yol sunması gerekir |
| 8 | **`node-pty` native varlıklarının yerleşimi** | `scripts/ensure-node-pty.mjs` kurulumda `spawn-helper`'ı `chmod 755` yapıyor; Linux prebuild'i yok | Paketleyici çalıştırma iznini korumalı, `.node` dosyaları arşiv dışında kalmalı, Linux binary'si Linux CI'da derlenmeli |
| 9 | **Tek örnek + temiz kapanış** | Yok | İki kopya aynı veri dosyalarını yazarsa bozulma olur; pencere kapanınca PTY çocukları öksüz kalmamalı |

---

## Takip issue'ları

Sırayla açılması önerilen issue'lar. Her biri bağımsız olarak birleştirilebilir.

1. **`refactor: configurable data root`** — `data/` yolunu çalışma dizini yerine tek bir
   çözümleyiciden (`AGENTHUB_DATA_DIR` → işletim sistemine özgü varsayılan) al; yerleşik
   prompt dosyalarını da aynı şekilde çöz. Ön koşul #1 ve #2.
2. **`feature: packaged production build`** — `output: "standalone"` + `server.ts`'in
   önceden derlenmesi + `public` / `.next/static` / `node-pty` varlıklarının yerleştirilmesi;
   çıktı, repo dışında `tsx` olmadan çalışmalı. Ön koşul #3, #4, #8.
3. **`feature: dynamic port and readiness signal`** — boş port seçimi, stdout üzerinden
   yapılandırılmış hazır-olma satırı, tek örnek kilidi. Ön koşul #5, #9.
4. **`spike: Tauri 2 desktop shell with Node sidecar`** — `desktop/` dizini,
   `pnpm-workspace.yaml` `packages:` girdisi, `externalBin` + capabilities, port el sıkışması,
   üç platformda "PTY açılıyor mu" smoke testi. Zaman kutulu; başarısız olursa 5'e geç.
   1–3'e bağımlı.
5. **`spike: Electron fallback shell`** *(yalnızca 4 başarısız olursa)* — `asarUnpack` ile
   `node-pty`, `UtilityProcess` içinde sunucu, fuses ile sertleştirme.
6. **`feature: license service`** — düzenleme + doğrulama uçları, Ed25519 anahtar yönetimi,
   cihaz kayıtları, iptal. Ayrıntı: [`desktop-licensing.md`](./desktop-licensing.md).
7. **`feature: license client in the desktop app`** — etkinleştirme ekranı, imzalı lisans
   dosyası doğrulaması, çevrimdışı tolerans, kademeli kısıtlama davranışı. 6'ya bağımlı.
8. **`chore: code signing and notarization pipeline`** — Apple Developer ID + `notarytool`,
   Windows Authenticode / Azure Trusted Signing, CI'da gizli anahtar yönetimi.
9. **`feature: auto-update channel`** — Tauri updater (imza zorunlu, anahtar kaybı geri
   dönüşsüz), manifest barındırma, sürüm yayın akışı. 8'e bağımlı.
10. **`docs: desktop product posture`** — `PROJECT_DOCUMENT.md` üzerinde "yerel araç" →
    "ücretli masaüstü ürünü" duruş değişikliğinin kaydı, destek ve gizlilik sonuçları.

---

## Kaynaklar

Erişim tarihi: 2026-09-04.

Yerel, sürüme bağlı kaynaklar (en güvenilir): `node_modules/next/dist/docs/01-app/02-guides/custom-server.md`,
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`,
`node_modules/node-pty/` (package manifest, `lib/utils.js`, `lib/unixTerminal.js`,
`scripts/prebuild.js`, `prebuilds/`).

- [Tauri v2 — Harici binary'leri gömme (sidecar)](https://v2.tauri.app/develop/sidecar/)
- [Tauri v2 — Updater eklentisi](https://v2.tauri.app/plugin/updater/)
- [Tauri v2 — Linux grafik sorunları (WebKitGTK)](https://v2.tauri.app/develop/debug/linux-graphics/)
- [Node.js — Tek çalıştırılabilir uygulamalar](https://nodejs.org/api/single-executable-applications.html)
- [Electron — Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Electron — "runAsNode" CVE'leri hakkında açıklama](https://www.electronjs.org/blog/statement-run-as-node-cves)
- [Electron — ASAR bütünlüğü](https://github.com/electron/electron/blob/main/docs/tutorial/asar-integrity.md)
- [GHSA-xw5q-g62x-2qjc / CVE-2025-55305 — ASAR bütünlüğü atlatma](https://github.com/electron/electron/security/advisories/GHSA-xw5q-g62x-2qjc)
- [Electron Forge — Yerel modülleri otomatik arşivden çıkarma eklentisi](https://www.electronforge.io/config/plugins/auto-unpack-natives)
- [jscdecompiler — Electron kaynak kodu koruması bozuk](https://jscdecompiler.com/blog/electron-source-code-protection)
- [bytenode](https://github.com/bytenode/bytenode)
- [Microsoft Learn — Windows uygulama geliştiricileri için kod imzalama seçenekleri](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Azure Artifact Signing (önceki adıyla Trusted Signing)](https://azure.microsoft.com/en-us/products/artifact-signing)
- [Apple Developer — Notarization](https://developer.apple.com/forums/topics/code-signing-topic/code-signing-topic-notarization)
