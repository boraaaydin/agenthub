# Plan kapatma onayının sayfa yenilemesinden sonra da görünmesi

## Description

Yürütmesi biten bir planın konsoldaki "task ve planı kapatayım mı" onay bölümü şu anda
yalnızca `/console` sekmesi açık kaldığı sürece görünür; sekme yenilenirse, kapatılıp yeniden
açılırsa veya konsol ikinci bir sekmede açılırsa buton kaybolur ve kullanıcı planı yalnızca
plan detay sayfasından elle kapatabilir.

Bunun nedeni, hangi oturumun hangi planı yürüttüğü bilgisinin (`planId` / `projectId` /
`taskId`) sadece istemci belleğinde (`use-plan-execution.ts` içindeki state) tutulmasıdır.
Bu görev, yürütme bilgisini sunucudaki oturum kaydına (in-memory session registry) taşır ve
onay bölümünü sunucu durumundan türetir: yürütme oturumu konsolda durduğu ve planın durumu
`executed` olduğu sürece, konsol hangi sekmede açılırsa açılsın kapatma butonu görünür.

Ayrıca durum geçişleri sunucu durumundan mutabakatla (reconciliation) yapılır: yürütme
oturumu sona ermiş ama planı hâlâ `executing` görünüyorsa (örneğin agent çıktığı sırada
tarayıcı kapalıydı), konsol bir sonraki bağlanışında planı `executed` yapar.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

Mevcut akış ve dosyalar:

- `src/lib/agent-protocol.ts` — `SessionSummary` (`id`, `agent`, `cwd`, `state`, `createdAt`),
  `ClientMessage` `start` mesajı (`agent`, `cwd`, `cols`, `rows`, `autoClose?`,
  `initialPrompt?`) ve `isClientMessage` doğrulaması.
- `server/session-registry.ts` — `TerminalSession = SessionSummary & { pty, buffer, autoClose,
  stoppedByUser }`; `create(agent, cwdInput, cols, rows, autoClose, initialPrompt)`,
  `list()` (satır ~35, özet alanlarını tek tek seçiyor), `stop`, `dismiss` (yalnızca `exited`
  oturumu siler).
- `server.ts` — `start` mesajını `sessions.create(...)` çağrısına aktarır, `toSummary(...)`
  (satır ~185) ile özet üretir, `broadcastSessions()` her oturum değişiminde tüm istemcilere
  `{ type: "sessions", sessions }` yollar; PTY çıkışında `onExit` hem `exit` mesajını hem de
  `broadcastSessions()` çağrısını yapar.
- `src/app/console/use-task-run.ts` — `/api/plans/{planId}/task-prompt` yanıtını doğrular,
  `startSession(body.agent, project, body.prompt, false)` çağırır, ardından
  `beginExecution({ planId, projectId, taskId })` çağırıp `/console` adresine `router.replace`
  yapar.
- `src/app/console/use-plan-execution.ts` (159 satır) — yürütmeyi istemci belleğinde tutan
  hook: `beginExecution` (plan → `executing` PATCH), `claimSession` (`onStarted` ile ilk
  oturumu sahiplenir), `handleSessionExit` (`onExit` ile plan → `executed` PATCH ve
  `prompt: "open"`), `dismissPrompt`, `confirmClose(dismissExitedSession)`
  (plan → `completed`, task → `completed`, oturum `dismiss`).
- `src/app/console/plan-close-prompt.tsx` — onay bölümü bileşeni; `planId`, `taskId`,
  `isClosing`, `isCompleted`, `onConfirm`, `onDismiss` props'larını alır.
- `src/app/console/agent-console.tsx` (469 satır) — `usePlanExecution({ setError })` çağrısı
  (satır ~58-64), `onStarted` içinde `claimSession(session.id)` (satır ~108), `onExit` içinde
  `handleSessionExit(sessionId)` (satır ~117), `startSession(...)` (satır ~212),
  `dismissExitedExecution(sessionId)` (satır ~259), `PlanClosePrompt` render'ı (satır ~440).
- `src/app/api/plans/[planId]/route.ts` — `GET` planı (durumuyla birlikte) döndürür; `PATCH`
  `{ "status": ... }` gövdesini kabul eder ve planın projesi ile task'ının hâlâ var olmasını
  şart koşar.
- `src/lib/plan-filters.ts` — istemci güvenli `PlanStatus`, `PLAN_STATUSES`,
  `planStatusLabel`. Bu dosya `.agent/tasks/plan-list-default-active-status-filter.md` görevi
  tarafından da (filtre sabitleri için) değiştiriliyor; bu görev `plan-filters.ts` dosyasını
  değiştirmez, yalnızca `PlanStatus` tipini içeri aktarır.

Notlar ve varsayımlar:

- Oturum kaydı yalnızca bellekte tutulur; sunucu yeniden başladığında oturumlar da yok olur.
  Bu nedenle "kalıcılık" hedefi **sunucu çalıştığı sürece** geçerlidir: sayfa yenileme, sekme
  kapatıp açma ve ikinci sekme kapsam içindedir, sunucu yeniden başlatması kapsam dışıdır.
  Sunucu yeniden başladıktan sonra plan `executed` olarak kalır ve plan detay sayfasından elle
  kapatılabilir; bu mevcut davranış korunur.
- Uygulamanın tüm arayüz metinleri İngilizce; bu görevdeki yeni arayüz metinleri de İngilizce
  yazılır (varsayım).
- Onay bölümünün "Keep plan open" seçeneği sekme ömrü boyunca gizler; sayfa yenilendiğinde
  plan hâlâ `executed` ve oturumu konsolda durduğu için bölüm yeniden görünür. Bu, görevin
  amaçlanan davranışıdır (karar hâlâ verilmemiştir), varsayım olarak kabul edilir.

## Acceptance Criteria

- [ ] `src/lib/agent-protocol.ts` yürütme bilgisi için istemci ve sunucunun paylaştığı bir tip
      yayımlar (`SessionExecution = { planId: number; projectId: string; taskId: number }`);
      `SessionSummary` isteğe bağlı bir `execution?: SessionExecution` alanı taşır ve `start`
      istemci mesajı isteğe bağlı bir `execution?: SessionExecution` alanı kabul eder.
- [ ] `isClientMessage`, `start` mesajındaki `execution` alanını doğrular: alan yoksa mesaj
      geçerlidir; varsa `planId` ve `taskId` pozitif tam sayı, `projectId` boş olmayan ve makul
      bir uzunluk sınırını (ör. 200 karakter) aşmayan bir metin olmalıdır. Geçersiz `execution`
      taşıyan bir `start` mesajı bugünkü geçersiz-mesaj yolundan reddedilir.
- [ ] `server/session-registry.ts` `create(...)` çağrısı yürütme bilgisini alır, oturumla
      birlikte saklar ve `list()` her oturum özetinde bu bilgiyi döndürür; yürütme bilgisi
      olmayan oturumların özetinde alan bulunmaz.
- [ ] `server.ts` `start` mesajındaki `execution` alanını `sessions.create(...)` çağrısına
      aktarır ve `toSummary(...)` bu alanı `started` mesajına da ekler; böylece hem
      `{ type: "sessions" }` hem de `{ type: "started" }` mesajları yürütme bilgisini taşır.
- [ ] `use-task-run.ts` yürütme oturumunu başlatırken `planId`, `projectId` ve `taskId`
      bilgisini `startSession(...)` üzerinden `start` mesajına ekler; oturumun sahiplenilmesi
      artık `onStarted` sırasına değil bu bilgiye dayanır.
- [ ] `use-plan-execution.ts` yürütme durumunu sunucudan gelen oturum listesinden türetir:
      seçili oturum `execution` bilgisi taşıyorsa o plan için durum okunur
      (`GET /api/plans/{planId}`) ve bölüm buna göre render edilir. Aynı plan için durum
      isteği, konsol her yeniden render olduğunda tekrarlanmaz.
- [ ] Yürütme oturumu `running` durumdayken kapatma onayı gösterilmez.
- [ ] Yürütme oturumu `exited` durumdayken planın durumu `executed` ise kapatma onayı bölümü
      görünür; bölüm plan id'sini ve task id'sini adlandırır ve bugünkü iki eylemi
      (birincil "kapat", ikincil "açık bırak") korur.
- [ ] Yürütme oturumu `exited` durumdayken planın durumu hâlâ `executing` ise konsol planı bir
      kez `executed` yapar (`PATCH /api/plans/{planId}`) ve ardından onay bölümünü gösterir;
      bu mutabakat, agent çıktığı sırada hiçbir tarayıcı bağlı olmasa bile konsol bir sonraki
      açılışında çalışır.
- [ ] Planın durumu `completed` veya `cancelled` ise (ör. kullanıcı planı plan detay
      sayfasından kapatmışsa) konsol o oturum için onay bölümünü göstermez.
- [ ] Kapatma onaylandığında bugünkü sıra korunur: plan `PATCH /api/plans/{planId}` ile
      `completed`, task `PATCH /api/projects/{projectId}/tasks/{taskId}` ile `completed` yapılır
      ve sona ermiş oturum `dismiss` mesajıyla konsoldan kaldırılır; işlem bittiğinde bölüm
      yerini kısa bir başarı bildirimine bırakır.
- [ ] Kapatma adımlarından biri başarısız olursa hangi adımın başarısız olduğunu söyleyen bir
      hata mesajı gösterilir, bölüm açık kalır ve eylem yeniden denenebilir; başarılı olmuş
      adımların tekrarı sorun çıkarmaz.
- [ ] `/console` sayfası yenilendiğinde veya ikinci bir sekmede açıldığında, yürütme oturumu
      konsolda durduğu ve plan `executed` olduğu sürece kapatma onayı yeniden görünür.
- [ ] Kullanıcının elle başlattığı oturumlar ve planlama oturumları (`planProjectId` /
      `planTaskId`, `autoClose = true`) `execution` bilgisi taşımaz; bu oturumlar sona
      erdiğinde hiçbir kapatma onayı görünmez ve mevcut davranışları değişmez.
- [ ] Aynı anda birden fazla yürütme oturumu varsa, gösterilen onay bölümü konsolda seçili olan
      oturuma aittir ve onun plan/task id'lerini gösterir.
- [ ] Yeni veya değiştirilen hiçbir dosya 600 satırı aşmaz.
- [ ] `.agent/PROJECT_DOCUMENT.md` güncellenir: yürütme oturumlarının sunucu tarafındaki oturum
      kaydında plan/proje/task bilgisini taşıdığı ve konsolun kapatma onayını bu bilgiden
      türeterek sayfa yenilemesinden sonra da gösterdiği, sunucu yeniden başlatmasının bu
      bilgiyi (oturumlarla birlikte) sildiği "Delivered session capabilities" maddesine işlenir.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Yeni Next.js API'leri yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehber
  okunmalıdır; route handler'lar `RouteContext<...>` ve `await context.params` kullanır.
- Önerilen değişiklikler:
  - `src/lib/agent-protocol.ts`: `SessionExecution` tipi + `isSessionExecution(value)` yardımcı
    doğrulayıcısı; `SessionSummary` ve `start` mesajına isteğe bağlı alan. Doğrulayıcı
    `isDimension` / `isSessionId` ile aynı üslupta yazılır.
  - `server/session-registry.ts`: `create(...)` imzası büyümeye başladığı için parametreleri
    tek bir seçenek nesnesine (`{ agent, cwd, cols, rows, autoClose, initialPrompt, execution }`)
    almak tercih edilebilir; bu yapılırsa `server.ts` içindeki tek çağrı yeri de güncellenir.
    `list()` içindeki alan seçimi `execution` alanını da içermelidir.
  - `src/app/console/agent-console.tsx`: `startSession(...)` isteğe bağlı bir `execution`
    parametresi alır ve `start` mesajına ekler; `usePlanExecution` çağrısına `sessions` ve
    `selectedSessionId` geçirilir. `onStarted` içindeki `claimSession` ve `onExit` içindeki
    `handleSessionExit` çağrılarına artık gerek kalmaz, çünkü sunucu her çıkışta
    `broadcastSessions()` ile oturum listesini günceller; kullanılmayan kod bırakılmaz.
  - `src/app/console/use-plan-execution.ts`: hook, oturum listesinden türetilen bir modele
    dönüşür. Önerilen iç yapı:
    - `planStatuses: Map<number, PlanStatus>` state'i ve `dismissedPlanIds: Set<number>`
      state'i.
    - Seçili oturum `execution` taşıyorsa ve o plan için durum henüz okunmamışsa
      `GET /api/plans/{planId}` ile okunur; istekler `AbortController` ile iptal edilebilir
      olmalı ve bileşen ayrıldıktan sonra state güncellenmemelidir (mevcut dosyadaki
      `mountedRef` / `controllersRef` örüntüsü korunur).
    - Oturum `exited` ve okunan durum `executing` ise bir kez `executed` PATCH'i yapılır;
      aynı plan için tekrar tetiklenmemesi için "reconciled" plan id'leri bir ref'te tutulur.
    - Render için hook, `PlanClosePrompt`'a doğrudan geçirilebilecek bir nesne döndürür
      (`null` ya da `{ planId, taskId, isClosing, isCompleted }`).
  - `src/app/console/plan-close-prompt.tsx`: bileşenin props sözleşmesi değişmeyebilir;
    değişirse metinler İngilizce kalır.
- Durum mutabakatı yalnızca iki geçişi yapar: oturum `exited` iken `executing → executed`.
  `registered`, `completed` ve `cancelled` durumlarına konsol kendiliğinden dokunmaz; böylece
  plan detay sayfasından yapılan elle durum değişiklikleri geri alınmaz.
- `dismiss` yalnızca `exited` oturumda çalışır; kapatma akışında oturum zaten sona ermiş olduğu
  için ek bir `stop` gerekmez.
- Kapsam dışı: yürütme bilgisinin diske (`data/plans.json` veya yeni bir dosyaya) yazılması,
  sunucu yeniden başlatmasından sonra oturum kurtarma, plan detay sayfasına "plan ve task'ı
  birlikte kapat" eylemi eklenmesi, `/plans` filtreleri ve prompt bileşimi
  (`composeTaskPrompt`) değişiklikleri.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: `/plans` üzerinden **Execute plan** tıklanır; konsolda oturum başlar ve `/plans`
      yenilendiğinde plan `Executing` görünür.
- [ ] Manuel: agent çıkışı beklenir (veya **Stop session** ile sonlandırılır); plan `Executed`
      olur ve konsolda kapatma onayı görünür.
- [ ] Manuel: onay bölümü görünürken `/console` sayfası yenilenir; oturum seçili geldiğinde
      kapatma onayı yeniden görünür ve doğru plan/task id'lerini gösterir.
- [ ] Manuel: aynı konsol ikinci bir tarayıcı sekmesinde açılır; yürütme oturumu seçildiğinde
      kapatma onayı orada da görünür.
- [ ] Manuel: onay verilir; `/plans` üzerinde plan `Completed`, `/tasks` üzerinde task
      `Completed` görünür, oturum kenar çubuğundan kalkar ve sayfa yenilendiğinde onay bölümü
      artık görünmez.
- [ ] Manuel: ikinci bir yürütmede "Keep plan open" seçilir; plan `Executed` kalır, task durumu
      değişmez, oturum scrollback'i ile listede kalır ve sayfa yenilendiğinde onay bölümü
      yeniden görünür.
- [ ] Manuel: yürütme oturumu çalışırken tüm `/console` sekmeleri kapatılır, agent'ın çıkması
      beklenir ve konsol yeniden açılır; plan `Executed` olur ve kapatma onayı görünür.
- [ ] Manuel: elle başlatılan bir oturum ve bir planlama oturumu (`/tasks` üzerinden plan
      başlatma) denenir; bu oturumlar sona erdiğinde hiçbir kapatma onayı görünmez ve planlama
      oturumu bugünkü gibi otomatik kapanır.
