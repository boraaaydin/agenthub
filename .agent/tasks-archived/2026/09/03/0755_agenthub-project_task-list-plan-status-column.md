# Görev listesine plan durumu kolonu ekle

## Description

`/tasks` ekranındaki görev tablosuna, o görev için kayıtlı planın durumunu (`registered`,
`executing`, `executed`, `completed`, `cancelled`) gösteren yeni bir **Plan** kolonu eklenir.
Kolon, mevcut **Status** kolonundan sonra ve **Created** kolonundan önce yer alır.

Planı olan görevlerde plan durumu, `/plans` listesindeki ile aynı rozet stiliyle gösterilir ve
rozet ilgili planın detay sayfasına (`/plans/{planId}`) bağlanır. Planı olmayan görevlerde
hücre, sessiz (muted) bir yer tutucu gösterir.

Bu iş yalnızca görev listesi ekranını kapsar; görev detay sayfası, plan listesi, filtreler ve
plan/görev durum geçiş mantığı değişmez.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

- `src/app/tasks/page.tsx` — sunucu tarafında render edilen birleşik görev tablosu.
  `TaskRows` bileşeni Project, `#`, Title, Status, Created ve Actions kolonlarını basar; tablo
  `min-w-[760px]` genişliğindedir. Sayfa `listAllTasks` ile sayfa başına `TASKS_PAGE_SIZE`
  (10) görev okur ve `ProjectStoreError` / `TaskStoreError` durumlarını kullanıcıya mesajla
  bildirir.
- `src/lib/tasks-store.ts` — `Task` tipi (`id`, `projectId`, `title`, `detail`, `status`,
  `completedAt`, `createdAt`, `updatedAt`) ve `listAllTasks`.
- `src/lib/plans-store.ts` — `server-only`; `Plan` tipi (`id`, `projectId`, `taskId`, `title`,
  `filePath`, `summary`, `status`, `createdAt`, `updatedAt`), `data/plans.json` dosyasını okuyan
  private `readDocument`, eski `status` değerlerini düzelten private `normalizePlan`, sayfalı
  `listAllPlans` ve `PlanStoreError`. Şu anda göreve göre plan arayan dışa açık bir fonksiyon
  yok.
- `src/lib/plan-filters.ts` — client-safe yardımcılar: `planStatusLabel`,
  `planStatusBadgeClass`, `planDetailHref`, `PlanStatus` tipi.
- `src/app/plans/page.tsx` — plan rozetinin mevcut kullanımı:
  `inline-block rounded-md px-2 py-0.5 text-xs font-medium ${planStatusBadgeClass(plan.status)}`.
- Planlar göreve `projectId` + `taskId` çifti ile bağlıdır; bir görevin birden fazla planı
  kayıtlı olabilir.

## Acceptance Criteria

- [ ] `/tasks` tablosunda Status ile Created arasında `Plan` başlıklı yeni bir kolon görünür.
- [ ] Kayıtlı planı olan bir görevin satırında planın durumu, `/plans` listesindekiyle aynı
      etiket ve rozet sınıflarıyla (`planStatusLabel`, `planStatusBadgeClass`) gösterilir.
- [ ] Rozet, ilgili planın detay sayfasına (`planDetailHref(plan.id)`) giden bir bağlantıdır.
- [ ] Bir görevin birden fazla planı varsa en son oluşturulan (`createdAt` en büyük) planın
      durumu gösterilir; ek olarak kalan plan sayısı sessiz bir `+N` metniyle belirtilir.
- [ ] Planı olmayan görevlerde hücrede sessiz bir `—` yer tutucu görünür (bağlantı yok).
- [ ] Plan eşleştirmesi hem `projectId` hem `taskId` üzerinden yapılır; başka bir projenin aynı
      `taskId` değerine sahip planı yanlışlıkla eşleşmez.
- [ ] `data/plans.json` okunamadığında görev listesi çalışmaya devam eder: hata konsola loglanır
      ve tüm satırların Plan hücresi yer tutucu gösterir.
- [ ] Görev listesi sayfa başına en fazla `TASKS_PAGE_SIZE` görev gösterdiği hâlde plan verisi
      her sayfa render'ında yalnızca bir kez okunur (görev başına ayrı okuma yapılmaz).
- [ ] Mevcut proje/durum filtreleri, sayfalama, `Create plan` ve durum değiştirme aksiyonları
      değişmeden çalışmaya devam eder.

## Technical Notes

- Uygulamaya başlamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- `src/lib/plans-store.ts` dosyasına, sayfadaki görevlerin planlarını tek okumada döndüren yeni
  bir dışa açık fonksiyon eklenir; örneğin
  `listLatestPlansByTask(): Promise<Map<string, { plan: Plan; planCount: number }>>` veya
  benzeri bir imza. Anahtar `` `${projectId}:${taskId}` `` biçiminde üretilmeli ve anahtar
  üreten yardımcı da dışa açılmalıdır ki sayfa aynı biçimi tekrar yazmasın. Fonksiyon mevcut
  `normalizePlan` çıktısını kullanmalı, böylece eski (legacy) status değerleri de doğru
  eşlenir.
- Plan verisi `server-only` olduğundan okuma `src/app/tasks/page.tsx` içindeki sunucu
  bileşeninde yapılır; `TaskRows` bileşenine hazır bir map prop olarak geçirilir. Rozet
  etiketi/sınıfı için `@/lib/plan-filters` kullanılır (`plans-store` client tarafına
  sızdırılmaz).
- Plan okuması, mevcut `try/catch` bloğundan ayrı kendi `try/catch`'i içinde yapılır; hata
  durumunda boş bir map ile devam edilir ve `console.error` ile loglanır (görev listesi hata
  ekranına düşmez).
- Tablo genişliği yeni kolonu barındıracak şekilde artırılır (örn. `min-w-[760px]` →
  `min-w-[860px]`), böylece dar ekranlarda mevcut yatay kaydırma davranışı korunur.
- `AGENTS.md` içindeki Next.js sürüm uyarısı geçerlidir; gerekirse
  `node_modules/next/dist/docs/` altındaki ilgili rehber okunmalıdır.
- Dosyalar 600 satır sınırının altında tutulmalıdır.
- Değişiklik `.agent/PROJECT_DOCUMENT.md` içindeki "Delivered session capabilities" bölümündeki
  `/tasks` maddesine bir cümleyle yansıtılmalıdır.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `pnpm dev` ile `/tasks` açılır: planı olan bir görevde doğru plan durumu rozeti görünür ve
      rozet plan detayına gider; planı olmayan görevde yer tutucu görünür.
- [ ] Plan durumu `/plans/{planId}` üzerinden değiştirilip `/tasks` yenilendiğinde kolon yeni
      durumu gösterir.
- [ ] Geçici olarak bozuk bir `data/plans.json` ile `/tasks` hâlâ görev listesini render eder.
