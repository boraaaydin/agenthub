# Konsolda plan yürütme durumu ve kapatma akışı

## Description

Plan listesindeki **Execute task** eylemi **Execute plan** olarak yeniden adlandırılır ve
planlara bir yürütme durumu (`status`) yaşam döngüsü eklenir:

- Plan listesinden **Execute plan** ile konsolda bir yürütme oturumu başlatıldığında planın
  durumu `executing` olur.
- Yürütmeyi çalıştıran agent oturumu sonlandığında planın durumu `executed` olur ve konsol
  ekranında bir onay bölümü belirir; bu bölüm kullanıcıya task ile planın kapatılıp
  kapatılmayacağını sorar.
- Kullanıcı onaylarsa plan `closed`, ilgili task `completed` durumuna geçer ve sona ermiş
  agent oturumu konsoldan kapatılır (dismiss edilir).
- Kullanıcı onaylamazsa plan `executed` olarak kalır, oturum scrollback'i ile listede durur.

Plan durumu plan listesinde ve plan detay sayfasında rozet olarak gösterilir.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Mevcut parçalar:

- `src/app/plans/page.tsx` — sunucuda render edilen plan listesi; `PlanRows` her satırda proje
  chip'ini, plan id'sini, başlığı, tarihi, özeti, task bağlantısını, dosya yolunu ve
  `taskConsoleHref(plan.id)` adresine giden **Execute task** bağlantısını basar (satır ~52-62).
- `src/lib/task-run.ts` — `composeTaskPrompt(...)` ve `taskConsoleHref(planId)`
  (`/console?taskPlanId=…`).
- `src/app/console/use-task-run.ts` — `taskPlanId` parametresini okuyup
  `GET /api/plans/{planId}/task-prompt` çağıran, dönen yanıtı doğrulayan, projeyi ve agent'ı
  seçip `startSession(agent, project, prompt, false)` çağıran ve ardından `/console` adresine
  `router.replace` yapan istemci hook'u. `taskRunStartedRef` ile yalnızca bir kez çalışır.
- `src/app/console/agent-console.tsx` (441 satır) — `onStarted` (yeni oturum özeti),
  `onExit(sessionId, code)`, `startSession(...)`, `dismissSession(sessionId)`
  (`send({ type: "dismiss", sessionId })`) ve `useTaskRun({...})` çağrısı burada;
  `activeSessionRef`, `pendingSessionIdRef` gibi ref'ler oturum takibi için kullanılıyor.
- `src/lib/agent-protocol.ts` — `dismiss` istemci mesajı yalnızca `exited` durumundaki oturumu
  kaldırır (`server/session-registry.ts` `dismiss`, satır ~113).
- `src/lib/plans-store.ts` — `Plan` tipi (`id`, `projectId`, `taskId`, `title`, `filePath`,
  `summary`, `createdAt`, `updatedAt`), `isPlan` doğrulaması, `normalizePlan`, `createPlan`,
  `planPatch`, `updatePlan`, `listAllPlans`.
- `src/lib/plan-filters.ts` — istemci güvenli plan href yardımcıları
  (`planDetailHref`, `newPlanHref`, `plansHref`).
- `src/app/api/plans/[planId]/route.ts` — `GET` / `PATCH` / `DELETE`; `PATCH`, `planPatch` ile
  gövdeyi doğrular, proje ve task varlığını denetler, `updatePlan` çağırır.
- `src/app/api/projects/[id]/tasks/[taskId]/route.ts` — task `PATCH` uç noktası;
  `src/app/tasks/task-status-button.tsx` bunu `{ status: "completed" }` gövdesiyle çağırır.
- `src/lib/task-filters.ts` + `src/lib/tasks-store.ts` — task durum modelinin izlenecek örüntüsü:
  durum sabitleri ve etiketleri istemci güvenli `task-filters.ts` içinde, sunucu tarafı store
  bunları içeri aktarıp `normalizeTask` ile eksik alanı varsayılana çeviriyor.
- `src/app/tasks/page.tsx` (satır ~29-38, ~82-84) — durum rozetinin mevcut biçimi
  (`statusBadgeClasses` haritası + `inline-block rounded-md px-2 py-0.5 text-xs font-medium`).

Notlar:

- Plan kaydı sırasında (`POST /api/plans`) task zaten `plan_created` durumuna taşınıyor;
  bu davranış değişmez.
- Yürütme oturumu `autoClose = false` ile başlatıldığı için agent çıktıktan sonra oturum
  listede `exited` olarak kalır; bu davranış korunur, oturum yalnızca kullanıcı onayıyla
  veya elle dismiss edilir.
- Uygulamanın tüm arayüz metinleri İngilizce; bu görevdeki yeni arayüz metinleri de
  İngilizce yazılır (varsayım).

## Acceptance Criteria

- [ ] `src/lib/plan-filters.ts` istemci güvenli plan durum modelini yayımlar:
      `PLAN_STATUSES = ["registered", "executing", "executed", "closed"]`, `PlanStatus` tipi,
      `DEFAULT_PLAN_STATUS = "registered"`, `PLAN_STATUS_LABELS`
      (`Registered`, `Executing`, `Executed`, `Closed`), `isPlanStatus` ve `planStatusLabel`;
      `task-filters.ts` örüntüsü izlenir ve dosya sunucuya özel hiçbir modül içeri aktarmaz.
- [ ] `Plan` tipi zorunlu bir `status: PlanStatus` alanı taşır; `data/plans.json` içindeki
      `status` alanı olmayan eski kayıtlar okunurken reddedilmez ve `registered` olarak
      normalize edilir; geçersiz bir `status` değeri taşıyan dosya mevcut biçim hatasıyla
      reddedilir.
- [ ] `createPlan` yeni planı `status: "registered"` ile yazar; `planPatch` `status` alanını
      kabul eder, geçersiz değerde `PlanValidationError` fırlatır ve `PATCH /api/plans/{planId}`
      bu hatayı 400 ile döndürür.
- [ ] `PATCH /api/plans/{planId}` gövdesi yalnızca `{ "status": "executing" }` olduğunda da
      çalışır ve güncellenmiş planı döndürür.
- [ ] `/plans` listesindeki eylem **Execute plan** olarak adlandırılır; klavyeyle erişilebilir,
      görünür odak halkası taşır ve projesi bulunmayan planlarda bugünkü gibi devre dışı
      (bağlantısız) görünür.
- [ ] `/plans` listesinde her satır, plan durumunu görev listesindeki rozet biçimiyle uyumlu
      bir rozet olarak gösterir.
- [ ] Plan detay sayfası (`/plans/{planId}`) planın güncel durumunu okunur biçimde gösterir;
      durum bu ekrandan düzenlenmez.
- [ ] Konsol `taskPlanId` ile bir yürütme oturumu başarıyla başlattığında planın durumu
      `PATCH /api/plans/{planId}` ile `executing` yapılır; bu istek başarısız olursa oturum
      çalışmaya devam eder ve hata konsolun mevcut hata bandında görünür.
- [ ] Yürütme oturumu sona erdiğinde (agent `exit` mesajı) planın durumu aynı uç noktayla
      `executed` yapılır ve konsolda, task ile planın kapatılıp kapatılmayacağını soran bir
      onay bölümü görünür; bölüm plan id'sini ve task id'sini adlandırır.
- [ ] Onay bölümünde iki eylem bulunur: kapatmayı onaylayan birincil buton ve açık bırakmayı
      seçen ikincil buton. İkincisi yalnızca bölümü gizler; plan `executed`, task ve oturum
      olduğu gibi kalır.
- [ ] Kapatma onaylandığında sırasıyla plan `PATCH /api/plans/{planId}` ile `closed`, task
      `PATCH /api/projects/{projectId}/tasks/{taskId}` ile `completed` yapılır ve sona ermiş
      oturum `dismiss` mesajıyla konsoldan kaldırılır; işlem bittiğinde onay bölümü yerini
      kısa bir başarı bildirimine bırakır.
- [ ] Kapatma adımlarından herhangi biri başarısız olursa hangi adımın başarısız olduğunu
      söyleyen uygulanabilir bir hata mesajı gösterilir, onay bölümü açık kalır ve eylem
      yeniden denenebilir; başarılı olan adımlar tekrar denendiğinde sorun çıkarmaz.
- [ ] Onay bölümü yalnızca `taskPlanId` ile başlatılan yürütme oturumu için görünür; kullanıcının
      elle başlattığı oturumlar veya planlama (`planProjectId`/`planTaskId`) oturumları
      sonlandığında görünmez.
- [ ] Mevcut planlama akışı (`planProjectId` / `planTaskId`, `autoClose = true`) ve elle oturum
      başlatma davranışı değişmeden çalışır.
- [ ] Yeni veya değiştirilen hiçbir dosya 600 satırı aşmaz.
- [ ] `.agent/PROJECT_DOCUMENT.md` güncellenir: plan kayıtlarının bir durum alanı taşıdığı
      (`registered`, `executing`, `executed`, `closed`), plan listesindeki **Execute plan**
      eyleminin bu durumu ilerlettiği ve yürütme bittiğinde konsolun task ile planı kapatmayı
      önerdiği "Delivered session capabilities" maddesi ile yeni konsol hook'unun repository
      structure listesine eklenmesi.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Önerilen dosyalar:
  - `src/lib/plan-filters.ts`: durum sabitleri, etiketleri ve tip koruyucuları
    (`task-filters.ts` ile aynı düzen). `plans-store.ts` bu modülden içeri aktarır ve
    `export type { PlanStatus }` ile yeniden yayımlar; böylece istemci bileşenleri
    sunucuya özel `plans-store.ts` dosyasını içeri aktarmak zorunda kalmaz.
  - `src/lib/plans-store.ts`: `StoredPlan` içinde `status?: PlanStatus`, `isPlan` içinde
    `plan.status === undefined || isPlanStatus(plan.status)`, `normalizePlan` içinde
    `status: plan.status ?? DEFAULT_PLAN_STATUS`, `createPlan` içinde açık `status` yazımı ve
    `planPatch` içinde `Object.hasOwn(values, "status")` dalı.
  - `src/app/console/use-plan-execution.ts` (yeni): yürütme durumunun makinesi. En az
    `beginExecution({ planId, projectId, taskId })`, başlatılan oturumu sahiplenen
    `claimSession(sessionId)`, `handleSessionExit(sessionId)`, `confirmClose()` ve
    `dismissPrompt()` döndürür; render için `useState`, `onStarted`/`onExit` geri çağrılarından
    okunabilmesi için ref aynası tutar (`agent-console.tsx` içindeki geri çağrılar
    `useCallback([])` olduğu için state'i doğrudan okuyamaz).
  - `src/app/console/use-task-run.ts`: `startSession` başarılı olduktan sonra
    `beginExecution({ planId, projectId, taskId })` çağrılır; `executing` PATCH isteği
    ya bu hook'ta ya da `use-plan-execution.ts` içinde tek bir yerde yapılır (tercihen
    `beginExecution` içinde, böylece durum geçişleri tek dosyada toplanır).
  - `src/app/console/agent-console.tsx`: `onStarted` içinde bekleyen bir yürütme varsa
    `claimSession(session.id)`, `onExit` içinde `handleSessionExit(sessionId)`; onay bölümü
    oturum kontrollerinin yakınında render edilir. Dosyanın büyümesini sınırlı tutmak için
    onay bölümü ayrı bir bileşene (`src/app/console/plan-close-prompt.tsx`) alınabilir.
- Oturum sahiplenme kuralı: `beginExecution` sonrası ilk `started` olayı yalnızca yürütmenin
  `sessionId` alanı boşken sahiplenilir; böylece kullanıcının sonradan başlattığı oturumlar
  yanlışlıkla yürütme oturumu sanılmaz.
- `dismiss` yalnızca `exited` oturumda çalışır; kapatma akışında oturum zaten sona ermiş
  olduğu için ek bir `stop` gerekmez.
- Plan durumu güncelleyen istekler `AbortController` ile iptal edilebilir olmalı ve bileşen
  ayrıldıktan sonra state güncellememelidir.
- `PATCH /api/plans/{planId}` mevcut haliyle planın projesinin ve task'ının hâlâ var olmasını
  şart koşar; bu davranış değiştirilmez, ancak silinmiş task nedeniyle 404 dönerse konsol
  bunu hata bandında anlaşılır biçimde göstermelidir.
- Ayarlar ekranları, prompt bileşimi (`composeTaskPrompt`), plan dosyası önizlemesi ve plan
  silme akışı değiştirilmez.
- Kapsam dışı: `/plans` için durum filtresi, plan durumunun detay sayfasından elle
  düzenlenmesi ve otomatik yeniden yürütme.
- Yeni Next.js API'leri yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehber
  okunmalıdır; route handler'lar `RouteContext<...>` ve `await context.params` kullanır.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: `http://localhost:3000/plans` açılır; eylemin **Execute plan** olarak göründüğü
      ve her satırda durum rozetinin bulunduğu doğrulanır.
- [ ] Manuel: **Execute plan** tıklanır; konsolda yapılandırılmış Task agent'ı ile oturum başlar
      ve `/plans` yenilendiğinde planın durumu `Executing` görünür.
- [ ] Manuel: agent çıkışı beklenir (veya **Stop session** ile sonlandırılır); planın durumu
      `Executed` olur ve konsolda kapatma onayı bölümü görünür.
- [ ] Manuel: onay verilir; `/plans` üzerinde plan `Closed`, `/tasks` üzerinde task `Completed`
      görünür ve oturum konsol kenar çubuğundan kalkar.
- [ ] Manuel: ikinci bir yürütmede açık bırakma seçilir; plan `Executed` kalır, task durumu
      değişmez ve oturum scrollback'i ile listede kalmaya devam eder.
- [ ] Manuel: `curl -s -X PATCH http://localhost:3000/api/plans/1 -H "Content-Type: application/json" -d '{"status":"bogus"}'`
      400 ve uygulanabilir bir hata mesajı döndürür.
- [ ] Manuel: `status` alanı olmayan eski bir plan kaydı içeren `data/plans.json` ile `/plans`
      hatasız açılır ve o plan `Registered` görünür.
