# Görev listesine Active durum filtresi ekle

## Description

`/tasks` ekranındaki durum filtresine, plan listesindekiyle aynı mantıkta çalışan bir **Active** seçeneği eklenir ve bu seçenek listenin varsayılanı olur. Active filtresi, `completed` ve `cancelled` dışındaki tüm görev durumlarını (`open`, `plan_created`, `in_progress`) gösterir. Bugünkü varsayılan olan `open` filtresi seçilebilir bir seçenek olarak kalır, ancak artık varsayılan değildir.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

Plan tarafında bu davranış zaten mevcut ve referans alınacak kaynak odur:

- `src/lib/plan-filters.ts`: `PlanFilterStatus = PlanStatus | "all" | "active"`, `TERMINAL_PLAN_STATUSES`, bunlardan türetilen `ACTIVE_PLAN_STATUSES`, `DEFAULT_PLAN_FILTER_STATUS = "active"`, `planFilterStatus()` ve varsayılan durumu URL'den düşüren `plansHref()`.
- `src/lib/plans-store.ts`: `listAllPlans()` tekil `status` yerine `statuses?: readonly PlanStatus[]` alır.
- `src/app/plans/status-filter.tsx`: `Active` ve `All` seçenekleri, durum listesinin üstünde yer alır.
- `src/app/plans/page.tsx`: seçilen filtreye göre `statuses` hesaplar ve boş liste başlığını `No active plans` olarak üretir.

Görev tarafındaki bugünkü durum:

- `src/lib/task-filters.ts`: `TaskFilterStatus = TaskStatus | "all"`, `DEFAULT_TASK_STATUS = "open"` hem kayıt varsayılanı hem de filtre varsayılanı olarak kullanılıyor; `TERMINAL_TASK_STATUSES = ["completed", "cancelled"]` zaten tanımlı ve `src/app/plans/page.tsx` ile `src/app/api/plans/route.ts` tarafından kullanılıyor.
- `src/lib/tasks-store.ts`: `paginateTasks()`, `listProjectTasks()` ve `listAllTasks()` tekil `status?: TaskStatus` alıyor. `normalizeTask()` içindeki `DEFAULT_TASK_STATUS` kullanımı kayıt varsayılanıdır ve değişmemelidir.
- `src/app/tasks/status-filter.tsx`: yalnızca `All` + tüm durumlar listeleniyor.
- `src/app/tasks/page.tsx`: `taskFilterStatus()` ile seçili durumu çözüp `listAllTasks({ status })` çağırıyor ve boş liste başlığını `TASK_STATUS_LABELS[selectedStatus]` üzerinden üretiyor.
- `src/app/api/projects/[id]/tasks/route.ts`: `status` query parametresini `isTaskStatus()` ile doğrulayıp `listProjectTasks()`'a geçiriyor; parametre yoksa tüm görevleri döndürüyor.
- `src/app/projects/[id]/tasks/page.tsx`: `status`, `all` ve `page` parametrelerini olduğu gibi `/tasks`'e taşıyan bir yönlendirmedir.

## Acceptance Criteria

- [ ] `src/lib/task-filters.ts` içinde `TaskFilterStatus` tipi `TaskStatus | "all" | "active"` olarak genişletilir.
- [ ] `src/lib/task-filters.ts` içinde `ACTIVE_TASK_STATUSES`, `TASK_STATUSES` listesinden `TERMINAL_TASK_STATUSES` çıkarılarak türetilir (plan tarafındaki `ACTIVE_PLAN_STATUSES` ile aynı desen); sonucu `open`, `plan_created`, `in_progress` olur.
- [ ] `src/lib/task-filters.ts` içinde `DEFAULT_TASK_FILTER_STATUS: TaskFilterStatus = "active"` eklenir; kayıt varsayılanı olan `DEFAULT_TASK_STATUS: TaskStatus = "open"` olduğu gibi korunur.
- [ ] `taskFilterStatus()`, `all=true` için `"all"`, geçerli bir durum değeri için o durumu, aksi halde `DEFAULT_TASK_FILTER_STATUS` döner.
- [ ] `tasksHref()` ve `newTaskHref()`, durum varsayılana (`active`) eşitken URL'e `status` parametresi eklemez; `all` için `all=true`, diğer durumlar için `status=<durum>` yazmayı sürdürür.
- [ ] `src/lib/tasks-store.ts` içindeki `paginateTasks()`, `listProjectTasks()` ve `listAllTasks()` tekil `status` yerine `statuses?: readonly TaskStatus[]` alır ve filtreyi `statuses.includes(task.status)` ile uygular; `statuses` verilmediğinde filtre uygulanmaz.
- [ ] `src/app/tasks/status-filter.tsx` seçenekleri sırasıyla `Active`, `All` ve ardından tüm görev durumları olacak şekilde güncellenir.
- [ ] `src/app/tasks/page.tsx`, seçili filtre `all` ise `statuses` göndermez, `active` ise `ACTIVE_TASK_STATUSES`, tekil bir durum ise `[selectedStatus]` gönderir.
- [ ] `src/app/tasks/page.tsx` boş liste başlığı `active` için `No active tasks`, `all` için `No tasks`, tekil durumlar için mevcut `No <durum> tasks` metnini üretir; proje filtresiyle birlikte kullanılan `... for this project` eki çalışmaya devam eder.
- [ ] `src/app/api/projects/[id]/tasks/route.ts` yeni store imzasına uyarlanır ve mevcut davranışını korur: `status` parametresi verilmişse yalnızca o durum, verilmemişse tüm görevler döner.
- [ ] Parametresiz `/tasks` adresi açıldığında yalnızca `open`, `plan_created` ve `in_progress` görevler listelenir; `completed` ve `cancelled` görevler görünmez.
- [ ] `/tasks?status=completed`, `/tasks?status=cancelled` ve `/tasks?all=true` adresleri ilgili görevleri göstermeye devam eder; sayfalama, proje filtresi ve `New task` bağlantısı seçili filtreyi korur.
- [ ] `src/app/projects/[id]/tasks/page.tsx` yönlendirmesi değiştirilmeden çalışmayı sürdürür.

## Technical Notes

- Uygulamaya başlamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- `DEFAULT_TASK_STATUS` ile `DEFAULT_TASK_FILTER_STATUS` ayrı tutulmalıdır: birincisi `tasks-store.ts` içindeki `normalizeTask()` tarafından eski kayıtların durumunu doldurmak için kullanılır, ikincisi yalnızca liste filtresinin varsayılanıdır. `DEFAULT_TASK_STATUS`'un tipi `TaskStatus` kalmalıdır.
- `ACTIVE_TASK_STATUSES` türetilirken `TERMINAL_TASK_STATUSES` tekrar elle yazılmamalı; `plan-filters.ts` içindeki `filter(...)` deseni izlenmelidir; böylece ileride eklenecek yeni bir durum otomatik olarak aktif sayılır.
- `tasksHref()` bugün varsayılanı URL'e yazıyor; `plansHref()` gibi `status !== DEFAULT_TASK_FILTER_STATUS` koşuluna geçirilmelidir. Aynı koşul `newTaskHref()` için de geçerlidir, böylece `/tasks/new` dönüş bağlantıları aynı filtreye döner.
- `src/app/tasks/project-filter.tsx` ve `src/app/tasks/new/new-task-form.tsx` yalnızca `TaskFilterStatus` değerini `tasksHref()`'e taşır; tip genişletildiğinde ek değişiklik gerekmemelidir, yine de derleme sonrası doğrulanmalıdır.
- Görev listesi API'sinde (`/api/projects/[id]/tasks`) `active` gibi yeni bir query değeri tanıtılmaz; bu görev yalnızca UI filtresini kapsar.
- `src/app/tasks/task-status-button.tsx` davranışı değişmez; `Complete` işleminden sonra görev Active filtresinden düşer ve `router.refresh()` sonrası listeden kaybolur; bu beklenen sonuçtur.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `pnpm dev` ile `/tasks` açılır; varsayılan filtrenin `Active` olduğu ve tamamlanmış/iptal edilmiş görevlerin listelenmediği doğrulanır.
- [ ] Durum filtresi sırasıyla `All`, `Open`, `Plan created`, `In progress`, `Completed` ve `Cancelled` yapılır; her seçimde URL ve liste içeriği tutarlıdır.
- [ ] Proje filtresi ve sayfalama Active filtresi seçiliyken denenir; ileri/geri bağlantıları filtreyi korur.
- [ ] `/projects/{id}/tasks` adresi `/tasks?project={id}` adresine yönlenir ve Active listesi gelir.
