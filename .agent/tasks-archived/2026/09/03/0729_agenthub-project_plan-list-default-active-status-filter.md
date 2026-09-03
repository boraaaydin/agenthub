# Plan listesinde varsayılan olarak completed ve cancelled planları gizle ve status filtresi ekle

## Description

`/plans` ekranı bugün kayıtlı bütün planları listeliyor; tamamlanmış (`completed`) ve iptal
edilmiş (`cancelled`) planlar da listede duruyor ve zamanla aktif planları bastırıyor.

Bu görev, plan listesinin varsayılan olarak yalnızca **aktif** planları (`registered`,
`executing`, `executed`) göstermesini ve listenin üst tarafına, mevcut proje filtresinin
yanına bir **Status** filtresi eklenmesini kapsıyor. Filtre, `/tasks` ekranındaki mevcut
`ProjectFilter` + `StatusFilter` desenini birebir izler: seçim URL arama parametresinde
tutulur, sunucu tarafında uygulanır ve sayfalama bağlantıları seçimi korur.

Kapsam yalnızca `/plans` liste ekranıdır. Plan detay sayfası (`/plans/[planId]`), plan
oluşturma formu ve plan durumu değiştirme akışları bu görevde değişmez.

**Varsayım (görev metninin yorumu):** Görev "plan detay sayfası" diyor, ancak
`/plans/[planId]` tek bir planı gösterir; orada gizlenecek bir liste ve üstüne konacak bir
filtre yoktur. Planların listelendiği tek ekran `/plans` olduğu için görev bu ekrana
uygulanmıştır. İstenen gerçekten başka bir ekransa, uygulamadan önce doğrulanmalıdır.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

İlgili mevcut parçalar:

- `src/app/plans/page.tsx` — sunucu tarafında render edilen plan listesi. `searchParams`
  içinden `page` ve `project` okur, `listAllPlans({ page, pageSize, projectId })` çağırır,
  filtresiz ikinci bir `listAllPlans({ page: 1, pageSize: 1 })` çağrısıyla `hasAnyPlans`
  hesaplar, `ProjectFilter` bileşenini ve `plansHref(...)` ile sayfalama bağlantılarını
  render eder.
- `src/app/plans/project-filter.tsx` — `"use client"`; yalnızca `projects` ve
  `selectedProjectId` alır, değişimde `router.push(plansHref({ projectId }))` yapar; yani
  bugün proje değiştirildiğinde başka bir filtre korunmaz.
- `src/lib/plan-filters.ts` — client-safe: `PLAN_STATUSES`
  (`registered`, `executing`, `executed`, `completed`, `cancelled`), `PlanStatus`,
  `DEFAULT_PLAN_STATUS`, `PLAN_STATUS_LABELS`, `isPlanStatus`, `planStatusLabel`,
  `planStatusBadgeClass`, `planDetailHref`, `newPlanHref`, `plansHref({ projectId, page })`.
  Henüz bir filtre-durumu kavramı yok.
- `src/lib/plans-store.ts` — server-only. `listAllPlans({ page, pageSize, projectId })`
  planları normalize eder, `projectId`'ye göre filtreler, `createdAt` azalan sıralar ve
  sayfalar. Status alanı `normalizePlan` içinde eski kayıtlar için `DEFAULT_PLAN_STATUS`
  ile doldurulur; status'e göre filtreleme yoktur.
- `src/app/api/plans/route.ts` — `GET` yalnızca `page` ve `project` parametrelerini okuyup
  `listAllPlans` çağırır.
- `src/app/plans/new/new-plan-form.tsx` — kayıt sonrası `plansHref({ projectId })` yoluna
  yönlendirir.

Örnek alınacak referans uygulama (`/tasks`):

- `src/lib/task-filters.ts` — `TaskFilterStatus = TaskStatus | "all"`,
  `DEFAULT_TASK_STATUS`, `taskFilterStatus(value, showAll)` ve
  `tasksHref({ projectId, status, page })`. Varsayılan durum URL'de hiç parametre üretmez,
  `"all"` için `all=true`, diğer durumlar için `status=<value>` yazılır.
- `src/app/tasks/status-filter.tsx` — `"use client"`; etiketli bir `<select>` ile
  `router.push(tasksHref({ projectId, status }))` çağırır.
- `src/app/tasks/page.tsx` — filtreleri `<div className="flex flex-col gap-4 sm:flex-row sm:gap-5">`
  içinde listenin üstünde yan yana render eder, `selectedStatus`'ü sayfalama bağlantılarına
  taşır ve boş durum başlığını seçili filtreye göre metinler.

## Acceptance Criteria

- [ ] `/plans` adresi hiçbir arama parametresi olmadan açıldığında yalnızca `registered`,
      `executing` ve `executed` durumundaki planları listeler; `completed` ve `cancelled`
      planlar listede görünmez.
- [ ] Listenin üst tarafında, mevcut proje filtresinin yanında etiketli bir **Status**
      `<select>` filtresi bulunur; seçenekler sırasıyla varsayılan aktif seçim, tüm planlar
      ve `PLAN_STATUS_LABELS` içindeki beş durumun her biridir.
- [ ] Status filtresi, sayfadaki seçili değeri (URL'den türetilen değeri) gösterir; sayfa
      yenilendiğinde veya bağlantı paylaşıldığında aynı filtre geri gelir.
- [ ] Tüm planları gösteren seçim seçildiğinde `completed` ve `cancelled` dahil bütün planlar
      listelenir; tek bir durum seçildiğinde yalnızca o durumdaki planlar listelenir.
- [ ] Proje filtresi değiştirildiğinde seçili status korunur; status filtresi değiştirildiğinde
      seçili proje korunur. Her iki filtre değişimi de sayfalamayı ilk sayfaya döndürür.
- [ ] **Previous** / **Next** sayfalama bağlantıları hem seçili projeyi hem seçili status'ü
      taşır; sayfa değiştirildiğinde filtre kaybolmaz.
- [ ] Sonuç boşken gösterilen boş durum başlığı ve açıklaması seçili filtreleri yansıtır:
      hiç plan yokken bugünkü "No plans yet" metni korunur; plan varken filtre sonucu boşsa
      metin, filtre değiştirilerek diğer planların görülebileceğini söyler (`/tasks`
      ekranındaki `emptyTaskLabel` yaklaşımının plan karşılığı).
- [ ] `listAllPlans` status'e göre filtreleyebilir; status filtresi verilmediğinde davranışı
      bugünküyle aynı kalır, böylece `GET /api/plans` yanıtı bu görevde değişmez.
- [ ] Filtre bileşenleri klavyeyle kullanılabilir: her `<select>` için `<label>` ve `id`
      eşleşmesi ve listedeki diğer kontrollerle aynı focus ring stili bulunur.
- [ ] `.agent/PROJECT_DOCUMENT.md` güncellenir: plan listesinin varsayılan olarak aktif
      planları gösterdiği ve proje + status filtresi taşıdığı, plan kalıcılığını anlatan
      "Architecture" paragrafında ve "Delivered session capabilities" listesindeki plan
      maddesinde belirtilir.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalı.
- Next.js 16 kullanılıyor; yeni bir Next.js API'si yazmadan önce
  `node_modules/next/dist/docs/` altındaki ilgili rehber okunmalı. Sayfa
  `PageProps<"/plans">` ve `await props.searchParams` desenini kullanmayı sürdürmeli.
- `src/lib/plan-filters.ts` (client-safe kalmalı):
  - `TERMINAL_PLAN_STATUSES = ["completed", "cancelled"] as const` ve bundan türetilen
    `ACTIVE_PLAN_STATUSES` (yani `PLAN_STATUSES` içinden terminal olmayanlar) eklenir; böylece
    ileride eklenecek yeni bir ara durum otomatik olarak varsayılan görünüme dahil olur.
  - `PlanFilterStatus = PlanStatus | "all" | "active"` ve
    `DEFAULT_PLAN_FILTER_STATUS: PlanFilterStatus = "active"` eklenir.
  - `planFilterStatus(value: string | undefined, showAll?: string): PlanFilterStatus`,
    `taskFilterStatus` ile aynı sözleşmeyi izler: `showAll === "true"` ise `"all"`, geçerli
    bir `PlanStatus` ise o değer, aksi halde varsayılan.
  - `plansHref({ projectId, status, page })` imzası genişletilir: `"all"` için `all=true`,
    somut bir `PlanStatus` için `status=<value>`, `"active"` (varsayılan) için hiçbir status
    parametresi yazılmaz. Mevcut `projectId` ve `page` davranışı korunur.
  - `PLAN_FILTER_STATUS_LABELS` gibi bir etiket kaynağı ya da `<select>` içinde doğrudan
    "Active" / "All" metinleri kullanılabilir; etiketler İngilizce kalır.
- `src/lib/plans-store.ts`: `PaginationInput`'a `statuses?: readonly PlanStatus[]` eklenir ve
  `listAllPlans` filtresi `statuses === undefined || statuses.includes(plan.status)` biçiminde
  genişletilir. Tek bir `status` alanı yerine liste alınması, varsayılan aktif görünümün tek
  sorguda karşılanmasını sağlar.
- `src/app/plans/page.tsx`:
  - `searchParams`'tan `status` ve `all` okunur, `planFilterStatus(...)` ile
    `selectedStatus` hesaplanır.
  - `listAllPlans` çağrısına `statuses` geçilir: `"all"` → `undefined`,
    `"active"` → `ACTIVE_PLAN_STATUSES`, somut durum → `[selectedStatus]`.
  - `hasAnyPlans` hesabı filtresiz kalmayı sürdürür.
  - Filtreler `/tasks` ile aynı sarmalayıcı içinde yan yana render edilir.
  - `plansHref` çağrılarının tümüne `status: selectedStatus` eklenir.
- `src/app/plans/status-filter.tsx` (yeni, `"use client"`): `src/app/tasks/status-filter.tsx`
  yapısı kopyalanır; `projectId` ve `selectedStatus` alır, değişimde
  `router.push(plansHref({ projectId, status }))` çağırır.
- `src/app/plans/project-filter.tsx`: `selectedStatus: PlanFilterStatus` prop'u eklenir ve
  `plansHref({ projectId, status: selectedStatus })` ile push yapılır.
- `newPlanHref` ve `src/app/plans/new/new-plan-form.tsx` bu görevde değiştirilmez; yeni plan
  `registered` durumunda oluştuğu için varsayılan aktif listede zaten görünür.
- `GET /api/plans` bu görevde status parametresi almaz; `listAllPlans`'a `statuses`
  geçilmediği için yanıtı değişmemelidir.
- Dosya başına 600 satır sınırına uyulmalı; değişen dosyalar bu sınırın çok altında kalıyor.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: en az biri `completed` veya `cancelled` olan planlarla `http://localhost:3000/plans`
      açılır; varsayılan görünümde yalnızca `registered` / `executing` / `executed` planların
      listelendiği doğrulanır.
- [ ] Manuel: Status filtresinden tüm planlar seçilir ve tamamlanmış/iptal edilmiş planların
      listeye döndüğü, URL'in filtreyi taşıdığı ve sayfa yenilendiğinde seçimin korunduğu
      doğrulanır.
- [ ] Manuel: tek bir durum (ör. Completed) seçilir, ardından proje filtresi değiştirilir ve
      status seçiminin korunduğu görülür; birden fazla sayfa dolduran bir filtre için
      **Next** bağlantısının filtreyi koruduğu doğrulanır.
- [ ] Manuel: filtre sonucu boş kalan bir kombinasyonda boş durum metninin filtreyi
      değiştirmeyi önerdiği, hiç plan yokken ise mevcut "No plans yet" metninin korunduğu
      doğrulanır.
- [ ] Manuel: `curl -s "http://localhost:3000/api/plans" | head -c 400` çıktısının bu
      değişiklikten önceki gibi tüm planları döndürdüğü doğrulanır.
