# Plan detay sayfasında plan durumunu değiştirme

## Description

Plan detay sayfasına (`/plans/{planId}`) planın durumunu elle değiştirmeye yarayan bir kontrol
eklenir. Kullanıcı bu ekrandan planı **Cancelled** (iptal) veya **Completed** (tamamlandı)
durumuna alabilir; kontrol, plan durum enum'unun tüm geçerli değerlerini listeler.

Bu görev aynı zamanda plan durum enum'unu genişletir:

- `plan-execution-status-lifecycle.md` görevinde tanımlanan `closed` değeri `completed` olarak
  yeniden adlandırılır.
- Enum'a yeni bir `cancelled` değeri eklenir.

Nihai küme: `registered`, `executing`, `executed`, `completed`, `cancelled`.

Durum değişikliği "Save changes" beklenmeden anında kaydedilir ve sayfadan ayrılma yapılmaz;
task durumları etkilenmez.

## Application

Root application (`agenthub`)

## Dependencies

`.agent/tasks/plan-execution-status-lifecycle.md`

Bu görev, plan durum modelini (`src/lib/plan-filters.ts` içindeki `PLAN_STATUSES`, `PlanStatus`,
`DEFAULT_PLAN_STATUS`, `PLAN_STATUS_LABELS`, `isPlanStatus`, `planStatusLabel`), `Plan` tipindeki
`status` alanını, `planPatch` içindeki `status` dalını ve `PATCH /api/plans/{planId}` üzerinden
durum güncellemeyi hazır kabul eder. Bu nedenle **önce** `plan-execution-status-lifecycle.md`
uygulanmalı, ardından bu görev çalıştırılmalıdır.

## Context

Uygulama mimarisi ve mevcut yetenekler için önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.

Mevcut parçalar (bağımlı görev uygulandıktan sonraki hâliyle):

- `src/lib/plan-filters.ts` — istemci güvenli plan yardımcıları. Bugün yalnızca href
  yardımcılarını (`planDetailHref`, `newPlanHref`, `plansHref`) içeriyor; bağımlı görev buraya
  plan durum modelini ekliyor. Bu görev o modeli genişletir.
- `src/lib/plans-store.ts` — `Plan` tipi, `isPlan` doğrulaması, `normalizePlan`, `createPlan`,
  `planPatch`, `updatePlan`, `listAllPlans`. Sunucuya özel (`import "server-only"`), bu yüzden
  istemci bileşenleri durum sabitlerini `plan-filters.ts` üzerinden almalıdır.
- `src/app/api/plans/[planId]/route.ts` — `GET` / `PATCH` / `DELETE`. `PATCH`, gövdeyi
  `planPatch` ile doğrular, planın projesinin ve task'ının hâlâ var olduğunu denetler, sonra
  `updatePlan` çağırır; `PlanValidationError` 400 döner. Bu görevde API değişikliği gerekmez.
- `src/app/plans/[planId]/plan-detail.tsx` (197 satır, client component) — plan detay formu.
  Yerel `Plan` tipi (satır ~12-21) API alanlarını çoğaltıyor ve `status` alanını **içermiyor**.
  `currentPlan` state'i kaydetme sonrası güncelleniyor; `isSubmitting` bayrağı hem form
  kaydetme hem de silme için kullanılıyor. Hata deseni `role="alert"` kutusu, başarı deseni
  `role="status"` paragrafı (satır ~184-185). Header bölümü satır ~137-153 arasında.
- `src/app/plans/[planId]/page.tsx` — sunucu bileşeni; `getPlan(planId)` sonucunu doğrudan
  `PlanDetail`'e `plan` prop'u olarak veriyor, yani `status` alanı prop'a zaten geliyor.
- `src/app/plans/page.tsx` — plan listesi; bağımlı görev burada durum rozetini ekliyor.
  `Execute plan` bağlantısı satır ~52-61 civarında.
- `src/app/console/use-plan-execution.ts` ve `src/app/console/plan-close-prompt.tsx` — bağımlı
  görevde oluşturulan, yürütme bitiminde planı `closed` yapan konsol akışı. `closed` → `completed`
  yeniden adlandırması bu dosyaları da kapsar.
- `src/app/tasks/status-filter.tsx` — bu ekranda izlenecek `select` deseni (etiket + `h-11`
  yuvarlatılmış select, `focus:ring-3 focus:ring-sky-100`).
- `src/lib/task-filters.ts` — durum modelinin örüntüsü; `task-detail-status-change.md` görevi
  aynı deseni task detayında uyguluyor. İki görev farklı dosyalara dokunur, aralarında sıra
  bağımlılığı yoktur.
- `src/app/tasks/page.tsx` (satır ~29-38) — durum rozetinin mevcut görsel biçimi
  (`inline-block rounded-md px-2 py-0.5 text-xs font-medium`).

Kararlar:

- Kontrol biçimi: tüm durumları içeren tek bir `select`; ayrı "Cancel" / "Completed" butonu
  eklenmez. Detay formundaki mevcut "Cancel" butonu form sıfırlamaya aittir ve dokunulmaz.
- Uygulamanın tüm arayüz metinleri İngilizce; bu görevdeki yeni arayüz metinleri de İngilizce
  yazılır.

## Acceptance Criteria

- [ ] `src/lib/plan-filters.ts` içindeki `PLAN_STATUSES`
      `["registered", "executing", "executed", "completed", "cancelled"]` olur; `closed` değeri
      kalmaz. `PLAN_STATUS_LABELS` sırasıyla `Registered`, `Executing`, `Executed`, `Completed`,
      `Cancelled` etiketlerini verir ve `DEFAULT_PLAN_STATUS` `registered` olarak kalır.
- [ ] Kod tabanında `closed` plan durumuna yapılan tüm referanslar `completed` ile değiştirilir;
      `grep -rn '"closed"' src server` plan durumu için sonuç döndürmez.
- [ ] Konsolun kapatma akışı (`use-plan-execution.ts` / `plan-close-prompt.tsx`) planı
      `completed` durumuna geçirir ve ilgili task'ı bugünkü gibi `completed` yapar; akışın
      davranışı bunun dışında değişmez.
- [ ] `data/plans.json` içinde `"status": "closed"` taşıyan eski bir kayıt okunduğunda
      `/plans` ve `/plans/{planId}` hatasız açılır ve o plan `Completed` görünür; `status` alanı
      hiç olmayan kayıtlar bugünkü gibi `Registered` olarak normalize edilir.
- [ ] `plan-detail.tsx` içindeki yerel `Plan` tipi `status: PlanStatus` alanını taşır ve bu tip
      `@/lib/plan-filters` üzerinden içeri aktarılır (sunucuya özel `plans-store.ts` istemciye
      sızdırılmaz).
- [ ] Plan detay sayfasının header bölümü planın güncel durumunu, görev listesindeki rozet
      biçimiyle uyumlu bir rozet olarak gösterir.
- [ ] Header bölümünde, görünür bir `label` ile ilişkilendirilmiş ve beş durumun tamamını
      (`registered`, `executing`, `executed`, `completed`, `cancelled`) `PLAN_STATUS_LABELS`
      etiketleriyle listeleyen bir status seçim kontrolü bulunur; başlangıç değeri planın
      mevcut durumudur.
- [ ] Yeni bir durum seçildiğinde "Save changes" beklenmeden anında
      `PATCH /api/plans/{planId}` isteği `{ "status": "<yeni-status>" }` gövdesiyle gönderilir
      ve sayfadan ayrılma (redirect) yapılmaz.
- [ ] İstek başarılı olduğunda rozet, seçim kontrolünün değeri ve "Updated" tarihi API
      yanıtındaki plana göre güncellenir ve `router.refresh()` çağrılır.
- [ ] İstek sürerken seçim kontrolü disabled olur ve bir ilerleme göstergesi
      (ör. "Updating status…") görünür; istek bittiğinde kontrol tekrar etkinleşir.
- [ ] İstek başarısız olursa (`response.ok === false` ya da ağ hatası) mevcut `role="alert"`
      deseniyle uygulanabilir bir hata mesajı gösterilir ve seçim kontrolü planın değişmemiş
      durumuna geri döner.
- [ ] Başarılı değişiklikte `role="status"` alanında yeni durumu adlandıran bir onay mesajı
      gösterilir.
- [ ] Durum değişimi, formdaki project/task/title/file path/summary alanlarında kaydedilmemiş
      değişiklikleri sıfırlamaz ve form alanlarını kilitlemez; durum güncellemesi form
      kaydetme ve silme akışlarından ayrı bir bayrakla izlenir, eşzamanlı çift gönderim
      engellenir.
- [ ] Plan kaydetme, form sıfırlama ("Cancel"), dosya önizlemesi ve plan silme davranışları
      değişmeden çalışmaya devam eder; "Save changes" isteği gövdesine `status` eklenmez.
- [ ] Yeni veya değiştirilen hiçbir dosya 600 satırı aşmaz.
- [ ] `.agent/PROJECT_DOCUMENT.md` güncellenir: plan durum kümesinin
      `registered`, `executing`, `executed`, `completed`, `cancelled` olduğu ve planın
      durumunun plan detay sayfasından elle değiştirilebildiği yazılır; `closed` ifadesi kalmaz.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Sunucu tarafında yeni bir uç nokta gerekmez: `PATCH /api/plans/{planId}` yalnızca
  `{ "status": ... }` gövdesiyle de çalışır ve `planPatch` geçersiz değerde
  `PlanValidationError` → 400 döndürür.
- `closed` → `completed` yeniden adlandırması yalnızca bir metin değişimi değildir: bağımlı
  görevin ürettiği konsol kapatma akışındaki durum geçişleri ve varsa testler de güncellenmelidir.
  Değişiklik öncesi `grep -rn "closed" src server .agent/PROJECT_DOCUMENT.md` ile tüm kullanım
  yerleri çıkarılmalıdır.
- Durum rozeti için bağımlı görevde plan listesine eklenen rozet biçimi paylaşılabilir hâle
  getirilebilir (ör. `plan-filters.ts` içinde `planStatusBadgeClass(status)`); taşıma yapılırsa
  liste sayfasındaki görünüm birebir korunmalıdır.
- `plan-detail.tsx` şu an 197 satır; durum kontrolü ayrı bir istemci bileşenine
  (`src/app/plans/[planId]/plan-status-control.tsx`) alınırsa dosya sade kalır. Bileşen
  `planId`, mevcut `status` ve güncellenen planı geri veren bir `onUpdated(plan)` geri çağrısı
  alabilir; hata ve onay mesajları `plan-detail.tsx` içindeki mevcut `error` / `statusMessage`
  alanlarına yönlendirilmelidir.
- Durum güncelleyen istek `AbortController` ile iptal edilebilir olmalı ve bileşen ayrıldıktan
  sonra state güncellememelidir.
- `PATCH /api/plans/{planId}`, planın projesinin ve task'ının hâlâ var olmasını şart koşar;
  silinmiş bir task nedeniyle 404 dönerse hata mesajı bunu anlaşılır biçimde göstermelidir.
- `select` stilinde `src/app/tasks/status-filter.tsx` içindeki sınıflarla tutarlı kalın; bu
  ekranda "all" seçeneği bulunmaz, yalnızca gerçek durumlar listelenir.
- Next.js 16 kullanılıyor; gerekiyorsa `node_modules/next/dist/docs/` altındaki ilgili rehber
  okunmalıdır.
- Kapsam dışı: `/plans` listesinden durum değiştirme, `/plans` için durum filtresi, plan
  durumunun task durumuna otomatik yansıtılması ve durum geçişlerine kural
  (ör. "yalnızca ileri yönde") getirilmesi.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: `http://localhost:3000/plans/{planId}` açılır; header'da durum rozeti ve beş
      seçenekli status kontrolü görünür, kontrolün başlangıç değeri planın mevcut durumudur.
- [ ] Manuel: durum sırasıyla `Cancelled`, `Completed`, `Executing`, `Executed` ve `Registered`
      yapılır; her seferinde rozetin, kontrolün ve "Updated" tarihinin güncellendiği, sayfadan
      çıkılmadığı doğrulanır.
- [ ] Manuel: sayfa yenilenir ve `/plans` listesine dönülür; yeni durumun kalıcı olduğu ve
      listedeki rozetin aynı değeri gösterdiği doğrulanır.
- [ ] Manuel: title/summary alanlarında kaydedilmemiş değişiklik varken durum değiştirilir;
      alanların korunduğu ve kilitlenmediği doğrulanır.
- [ ] Manuel: `curl -s -X PATCH http://localhost:3000/api/plans/1 -H "Content-Type: application/json" -d '{"status":"closed"}'`
      400 ve uygulanabilir bir hata mesajı döndürür.
- [ ] Manuel: `data/plans.json` içine elle `"status": "closed"` yazılmış bir kayıt eklenir;
      `/plans` ve plan detay sayfası hatasız açılır ve plan `Completed` görünür.
- [ ] Manuel: bağımlı görevin konsol akışı yeniden denenir; yürütme bitip kapatma onaylandığında
      planın `Completed`, task'ın `Completed` olduğu doğrulanır.
