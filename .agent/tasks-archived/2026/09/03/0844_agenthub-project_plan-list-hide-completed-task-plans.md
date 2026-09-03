# Tamamlanan Task'ların Planlarını Plan Listesinde Gizle

## Description

Bir task `completed` (veya `cancelled`) durumuna geldiğinde, o task'a bağlı planlar `/plans`
listesinde varsayılan görünümde ve tekil plan durumu filtrelerinde artık listelenmesin. Gizleme
planın kendi durumundan (`registered`, `executing`, `executed`, `completed`, `cancelled`)
bağımsız çalışsın: task terminal duruma girdiği anda ona bağlı bütün planlar listeden düşsün.

Tek kaçış kapısı "All" durum filtresidir (`/plans?all=true`); orada terminal task'ların planları
da görünmeye devam eder.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

- Plan listesi `src/app/plans/page.tsx` içinde sunucu tarafında render edilir ve
  `listAllPlans({ page, pageSize, projectId, statuses })` çağrısıyla sayfalanır.
- Durum filtresi `src/lib/plan-filters.ts` içindeki `planFilterStatus()` ile çözülür ve
  `"all" | "active" | PlanStatus` değerlerinden birini üretir. Varsayılan `"active"`tir.
- `src/lib/plans-store.ts` içindeki `listAllPlans()` filtrelemeyi sayfalama diliminden (`slice`)
  önce yaptığı için, buraya eklenecek yeni bir filtre `total` ve `totalPages` değerlerini
  kendiliğinden doğru tutar.
- Plan kayıtları task'a `projectId` + `taskId` ikilisiyle bağlıdır; `plans-store.ts` bu ikili için
  zaten `planTaskKey(projectId, taskId)` yardımcısını dışa açar (`${projectId}:${taskId}`).
- Task durumları `src/lib/task-filters.ts` içinde tanımlıdır (`open`, `plan_created`,
  `in_progress`, `completed`, `cancelled`). `plan-filters.ts` içinde benzer bir
  `TERMINAL_PLAN_STATUSES` sabiti bulunur; aynı kalıp task tarafında henüz yoktur.
- `src/lib/tasks-store.ts` şu an yalnızca sayfalı listeleme (`listAllTasks`, `listProjectTasks`)
  ve tekil okuma (`getTask`) sunar; duruma göre sayfasız task listesi veren bir fonksiyon yoktur.
- `GET /api/plans` (`src/app/api/plans/route.ts`) da `listAllPlans()` kullanır ve şu an hiçbir
  durum filtresi uygulamaz. Uygulama içinde bu uç noktayı okuyan bir istemci yoktur; yalnızca
  `POST /api/plans` kullanılır.
- `src/app/tasks/page.tsx`, task listesindeki Plan sütunu için `listLatestPlansByTask()` kullanır;
  bu ayrı bir yoldur ve bu task kapsamında değiştirilmez.

## Acceptance Criteria

- [ ] `completed` durumundaki bir task'a bağlı planlar, plan durumları ne olursa olsun `/plans`
      varsayılan görünümünde (aktif planlar) listelenmez.
- [ ] Aynı planlar tekil plan durumu filtrelerinde de (`?status=registered`, `?status=executing`,
      `?status=executed`, `?status=completed`, `?status=cancelled`) listelenmez.
- [ ] `cancelled` durumundaki bir task'a bağlı planlar da aynı şekilde gizlenir.
- [ ] `/plans?all=true` ("All" filtresi) seçildiğinde terminal durumdaki task'ların planları
      listede görünmeye devam eder.
- [ ] `open`, `plan_created` ve `in_progress` durumundaki task'lara bağlı planların listelenmesi
      hiçbir filtrede değişmez.
- [ ] Sayfalama sayaçları gizlenen planları saymaz: sayfa boyutu, `Page X of Y` metni ve
      Previous/Next bağlantıları filtrelenmiş sonuç kümesiyle tutarlıdır.
- [ ] Filtre sonucu boş kaldığında mevcut boş-durum metinleri bozulmadan çalışır; hiç plan yokken
      hâlâ "No plans yet" görünür.
- [ ] `GET /api/plans` varsayılan olarak aynı gizlemeyi uygular ve `?all=true` sorgu parametresiyle
      terminal task'ların planlarını da döndürür.
- [ ] Plan detay sayfası (`/plans/{planId}`) ve doğrudan URL erişimi etkilenmez; gizlenen planlar
      hâlâ açılabilir, düzenlenebilir ve silinebilir.
- [ ] Task listesindeki (`/tasks`) Plan sütunu davranışı değişmez.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- `src/lib/task-filters.ts` içine `TERMINAL_TASK_STATUSES = ["completed", "cancelled"] as const`
  sabitini ekleyin; `plan-filters.ts` içindeki `TERMINAL_PLAN_STATUSES` kalıbını izleyin. Bu dosya
  istemci-güvenli kalmalıdır.
- `src/lib/tasks-store.ts` içine verilen durumlara ait bütün task'ları sayfalamasız döndüren bir
  fonksiyon ekleyin (ör. `listTasksByStatuses(statuses: readonly TaskStatus[]): Promise<Task[]>`);
  mevcut `readDocument()` + `normalizeTask()` akışını kullanın.
- `listAllPlans()` imzasına isteğe bağlı bir dışlama kümesi ekleyin (ör.
  `excludedTaskKeys?: ReadonlySet<string>`) ve `statuses` filtresinin yanında
  `!excludedTaskKeys?.has(planTaskKey(plan.projectId, plan.taskId))` koşulunu uygulayın. Bu, iki
  store'u birbirine bağımlı hâle getirmeden gizlemeyi tek yerde tutar; `plans-store.ts` içinden
  `tasks-store.ts` import etmeyin.
- `src/app/plans/page.tsx` içinde, seçili filtre `"all"` değilken terminal durumdaki task'ları
  okuyup `planTaskKey()` ile küme kurun ve `listAllPlans()` çağrısına geçirin; `"all"` seçiliyken
  kümeyi geçmeyin. Küme kurulumunu mevcut `try` bloğunun içinde yapın ki `TaskStoreError` da
  sayfanın hata mesajıyla yakalansın; bu durum için `tasks-store` hata sınıfına uygun bir mesaj
  ekleyin.
- `hasAnyPlans` sondaj çağrısı bütün planları saymaya devam etsin; böylece "No plans yet" yalnızca
  gerçekten hiç plan yokken gösterilir ve filtre boş kaldığında kullanıcı "All" filtresine
  yönlendiren mevcut metni görür.
- `src/app/api/plans/route.ts` içindeki `GET` için `?all=true` okuyan küçük bir yardımcı ekleyin ve
  sayfa ile aynı dışlama kümesini uygulayın; `POST` davranışı değişmez.
- Filtreleme veri katmanında yapılmalıdır; render sırasında satır atlayarak yapılan bir gizleme
  sayfalama sayaçlarını bozar.
- Kalıcı veride (`data/plans.json`) şema değişikliği yoktur; hiçbir plan kaydı silinmez veya
  durumu değiştirilmez.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: Bir task'a plan kaydedin, planın durumunu `registered` bırakın, task'ı `/tasks`
      üzerinden `completed` yapın ve `/plans` varsayılan görünümünde planın kaybolduğunu doğrulayın.
- [ ] Manuel: Aynı plan için `/plans?status=registered` ve `/plans?status=completed` görünümlerinde
      planın listelenmediğini, `/plans?all=true` görünümünde listelendiğini doğrulayın.
- [ ] Manuel: Task'ı yeniden `open` yaptığınızda planın varsayılan listeye geri döndüğünü ve
      `cancelled` yaptığınızda tekrar gizlendiğini doğrulayın.
- [ ] Manuel: Gizlenen planın detay sayfasının (`/plans/{planId}`) doğrudan URL ile hâlâ açıldığını
      doğrulayın.
