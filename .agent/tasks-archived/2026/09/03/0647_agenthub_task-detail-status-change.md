# Task detay sayfasında status değiştirme

## Description

Task detay sayfasında (`/projects/{id}/tasks/{taskId}`) şu anda yalnızca "Complete" / "Reopen" geçişi
yapılabiliyor; bu buton sadece `open` ve `completed` durumları arasında geçiş yapar ve diğer durumlarda
devre dışı kalır. Bu görevde detay sayfası, task'ın statusunun beş geçerli değerden (`open`,
`plan_created`, `in_progress`, `completed`, `cancelled`) herhangi birine değiştirilebileceği bir kontrolle
güncellenecek.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

- Uygulama mimarisi ve mevcut yetenekler için önce `.agent/PROJECT_DOCUMENT.md` okunmalı.
- Detay sayfası bileşeni: `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` (client component).
  İçindeki `changeTaskStatus()` fonksiyonu `taskStatus === "completed" ? "open" : "completed"` şeklinde
  sabit bir geçiş yapıyor ve butonu `taskStatus !== "open" && taskStatus !== "completed"` olduğunda
  disable ediyor.
- Status tanımları client-safe `src/lib/task-filters.ts` içinde: `TASK_STATUSES`, `TaskStatus`,
  `TASK_STATUS_LABELS`, `taskStatusLabel()`.
- Sunucu tarafı hazır: `PATCH /api/projects/{id}/tasks/{taskId}`
  (`src/app/api/projects/[id]/tasks/[taskId]/route.ts` → `updateTask()` in `src/lib/tasks-store.ts`)
  `status` alanında `isTaskStatus()` ile doğrulanan her geçerli statusu kabul ediyor ve
  `completedAt` alanını status `completed` ise şimdiki zamana, aksi halde `null` değerine ayarlıyor.
  Bu nedenle API tarafında değişiklik gerekmiyor.
- Status seçimi için kullanılabilecek mevcut `select` deseni: `src/app/tasks/status-filter.tsx`.
- Status rozeti (badge) renkleri şu anda yalnızca liste sayfasında, `src/app/tasks/page.tsx` içindeki
  yerel `statusBadgeClasses` sabitinde tanımlı; detay sayfası ise satır içi bir ternary ile sadece
  "completed" ve diğerleri ayrımını yapıyor.
- Liste sayfasındaki `src/app/tasks/task-status-button.tsx` bu görevin kapsamı dışında; davranışı
  değişmeden kalır.

## Acceptance Criteria

- [ ] Task detay sayfasının header bölümünde, mevcut "Complete" / "Reopen" butonunun yerine beş statusun
      tamamını (`open`, `plan_created`, `in_progress`, `completed`, `cancelled`) içeren, etiketleri
      `TASK_STATUS_LABELS` üzerinden gelen ve görünür bir `label` ile ilişkilendirilmiş bir status
      seçim kontrolü bulunur.
- [ ] Kontrolün başlangıç değeri task'ın mevcut statusudur.
- [ ] Yeni bir status seçildiğinde, "Save changes" beklenmeden anında
      `PATCH /api/projects/{projectId}/tasks/{taskId}` isteği `{ "status": "<yeni-status>" }` gövdesiyle
      gönderilir ve sayfadan ayrılma (redirect) yapılmaz.
- [ ] İstek başarılı olduğunda header'daki status rozeti, seçim kontrolünün değeri ve `completedAt`
      bilgisi API yanıtındaki değerlerle güncellenir; `router.refresh()` çağrılır.
- [ ] Status `completed` yapıldığında tamamlanma tarihi görünür olur; `completed` dışındaki bir statusa
      geçildiğinde tamamlanma tarihi satırı kaybolur.
- [ ] İstek sürerken kontrol disabled olur ve kullanıcıya bir ilerleme göstergesi (ör. "Updating status…")
      sunulur; istek bittiğinde kontrol tekrar etkinleşir.
- [ ] İstek başarısız olursa (`response.ok === false` ya da ağ hatası) mevcut hata deseniyle
      (`role="alert"` kutusu) hata mesajı gösterilir ve seçim kontrolü task'ın değişmemiş statusuna
      geri döner.
- [ ] Başarılı değişiklikte `role="status"` alanında yeni statusu belirten bir onay mesajı gösterilir.
- [ ] Status değişimi, formdaki title/detail alanlarında kaydedilmemiş değişiklikleri sıfırlamaz.
- [ ] Task'ın title/detail kaydetme, iptal ve silme davranışları ile "Create plan" bağlantısı değişmeden
      çalışmaya devam eder.

## Technical Notes

- Değişiklik `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` içinde yoğunlaşır; API ve store
  katmanına dokunulmaz.
- `changeTaskStatus()` fonksiyonu, hedef statusu parametre olarak alan bir hâle getirilebilir
  (ör. `changeTaskStatus(nextStatus: TaskStatus)`), böylece sabit toggle mantığı kaldırılır.
- `isSubmitting` bayrağı hem form kaydetme hem silme için kullanılıyor. Status güncellemesi için ayrı bir
  bayrak (ör. `isStatusUpdating`) kullanılması, status değişirken form alanlarının gereksiz yere
  kilitlenmesini önler; hangisi seçilirse seçilsin eşzamanlı çift gönderim engellenmelidir.
- Status rozeti için `src/app/tasks/page.tsx` içindeki `statusBadgeClasses` haritası client-safe
  `src/lib/task-filters.ts` modülüne taşınıp (ör. `taskStatusBadgeClass(status)`) hem liste hem detay
  sayfasında paylaşılabilir. Taşıma yapılırsa liste sayfasındaki görünüm birebir korunmalıdır.
- `select` stilinde `src/app/tasks/status-filter.tsx` içindeki sınıflarla tutarlı kalın; detay sayfasında
  "all" seçeneği bulunmaz, yalnızca gerçek statuslar listelenir.
- Next.js 16 kullanılıyor; gerekiyorsa `node_modules/next/dist/docs/` altındaki ilgili rehber okunmalı.
- Dosya başına 600 satır sınırına uyulmalı.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: bir task detay sayfasında statusu sırasıyla `plan_created`, `in_progress`, `cancelled`,
      `completed` ve `open` yapıp her seferinde rozetin ve seçim kontrolünün güncellendiğini,
      `completed` seçildiğinde tamamlanma tarihinin göründüğünü doğrulayın.
- [ ] Manuel: sayfayı yenileyip (veya `/tasks` listesine dönüp) yeni statusun kalıcı olduğunu ve liste
      filtrelerinde doğru göründüğünü doğrulayın.
- [ ] Manuel: title/detail alanlarında kaydedilmemiş değişiklik varken statusu değiştirin; alanların
      korunduğunu ve sayfadan çıkılmadığını doğrulayın.
