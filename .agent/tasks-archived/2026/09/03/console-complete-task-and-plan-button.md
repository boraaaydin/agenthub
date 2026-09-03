# Console Oturum Bilgi Satırı ve "Task ve planı tamamla" Butonu

## Description

Console ekranında seçili oturumun bağlı olduğu task/plan bilgisini terminalin üstünde tek satır olarak göster, proje yolunu hover ile açılan bir bilgi ikonuna taşı ve plan yürütme oturumları için terminalin altındaki "Show prompt" butonunun yanına, plan ile task'ı `completed` durumuna çeken ve oturumu kapatan bir "Task ve planı tamamla" butonu ekle.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

- Console UI'ı `src/app/console/agent-console.tsx` içindedir. Seçili oturum başlığı (`activeProject?.name` + `activeSession.cwd`) terminal kartının üstünde, "Show prompt" butonu ise terminal kartının hemen altındadır.
- Oturum protokolü `src/lib/agent-protocol.ts` içinde tanımlıdır. `SessionExecution` (`planId`, `projectId`, `taskId`) hem `start` mesajında hem de `SessionSummary` içinde opsiyoneldir; `server/session-registry.ts` bu alanı oturumla birlikte saklar ve `list()` ile geri döner.
- **Mevcut hata:** `agent-console.tsx` içindeki `startSession` beşinci bir parametre kabul etmiyor ve `send({ type: "start", ... })` çağrısına `execution` alanını eklemiyor. `use-task-run.ts` bu bilgiyi `startSession(..., execution)` ile gönderdiği hâlde sunucuya hiç ulaşmıyor; bu yüzden `SessionSummary.execution` pratikte hep boş kalıyor ve PROJECT_DOCUMENT'te anlatılan "yeniden yüklemeden sonra kapanış teklifi" davranışı çalışmıyor.
- Task'tan başlatılan planlama oturumları (`use-plan-run.ts`) hiçbir bağlam bilgisi taşımıyor; sadece `autoClose: true` ile başlatılıyor.
- Plan/task tamamlama mantığı `src/app/console/use-plan-execution.ts` içindeki `confirmClose` fonksiyonunda var: plan `PATCH /api/plans/{planId}` ile `completed`, task `PATCH /api/projects/{projectId}/tasks/{taskId}` ile `completed` yapılıyor, ardından çıkmış oturum `dismiss` ediliyor. Bu akış `plan-close-prompt.tsx` üzerinden yalnızca agent çıktıktan sonra teklif ediliyor.
- Sunucu `dismiss` mesajını yalnızca `state === "exited"` olan oturumlar için kabul eder (`server.ts`); çalışan bir oturum önce `stop` edilmelidir. `SessionRegistry.stop()` durumu senkron olarak `exited` yapar, bu yüzden `stop` mesajının hemen ardından gönderilen `dismiss` mesajı kabul edilir.
- Plan kaydı `GET /api/plans/{planId}` ile okunabilir (`title`, `taskId`, `projectId`, `status`). Tek bir task için **GET route'u yoktur**: `src/app/api/projects/[id]/tasks/[taskId]/route.ts` yalnızca `PATCH` ve `DELETE` içerir. Store tarafında `getTask(projectId, taskId)` mevcuttur (`src/lib/tasks-store.ts`).
- Kullanıcı kararları: buton **yalnızca** plan yürütme oturumlarında (planId taşıyan, "Execute plan" ile başlatılmış oturumlar) görünecek; "oturum kapansın" ifadesi **durdur + listeden kaldır** (stop + dismiss) anlamındadır.

## Acceptance Criteria

- [ ] `SessionExecution` tipi, `planId`'nin opsiyonel olduğu genel bir oturum bağlamına dönüştürülür (ör. `SessionContext = { projectId: string; taskId: number; planId?: number }`); doğrulayıcı (`isSessionExecution` → yeni ad) opsiyonel `planId`'yi kabul eder, `projectId`/`taskId` için mevcut kuralları korur, `planId` verildiyse pozitif tam sayı olmasını şart koşar.
- [ ] `agent-console.tsx` içindeki `startSession`, bağlam parametresini alır ve `start` WebSocket mesajına ekler; `use-task-run.ts` plan yürütme oturumu için `{ planId, projectId, taskId }`, `use-plan-run.ts` planlama oturumu için `{ projectId, taskId }` gönderir.
- [ ] Seçili oturumun bağlamı, hook durumundan değil `SessionSummary` üzerinden okunur; böylece sayfa yenilendikten sonra veya başka bir sekmede seçilen oturumda da bilgi satırı ve buton görünür.
- [ ] `GET /api/projects/[id]/tasks/[taskId]` route'u eklenir; geçerli proje/task için task kaydını, aksi hâlde mevcut `PATCH`/`DELETE` ile aynı biçimde `404` veya `500` hata gövdesini döner.
- [ ] Terminal kartının üstünde, proje adının altında tek satırlık bilgi gösterilir:
  - [ ] planId taşıyan oturumda `Plan {planId}(Task {taskId}) - {plan başlığı}` (`GET /api/plans/{planId}`).
  - [ ] yalnızca task taşıyan planlama oturumunda `Task {taskId} - {task başlığı}` (yeni task GET route'u).
  - [ ] bağlamı olmayan oturumda satır gösterilmez ve başlık alanı hatasız çalışır.
  - [ ] başlık yüklenirken ve yükleme başarısız olduğunda satır kırılmadan yedek metin gösterilir (ör. numara satırı başlıksız gösterilir).
- [ ] Proje yolu artık düz metin olarak değil, bilgi satırının yanındaki bir bilgi (info) ikonu üzerinden gösterilir; ikon fare ile üzerine gelindiğinde ve klavye odağında yolu gösterir, ileride başka alanların eklenebileceği bir bilgi kutusu yapısındadır ve ekran okuyucular için erişilebilir bir etikete sahiptir.
- [ ] Terminalin altında, "Show prompt" butonunun yanında yalnızca planId taşıyan oturumlarda "Task ve planı tamamla" butonu görünür.
- [ ] Butona basıldığında sırasıyla: plan `completed` yapılır, task `completed` yapılır, oturum çalışıyorsa durdurulur ve ardından listeden kaldırılır; konsol yeni oturum moduna döner.
- [ ] İşlem sürerken buton devre dışıdır ve ilerlemeyi belirten bir etiket gösterir; herhangi bir adım başarısız olursa mevcut hata bandında hangi adımın başarısız olduğunu söyleyen bir mesaj çıkar ve buton yeniden denenebilir hâle gelir.
- [ ] Agent çıktıktan sonra gösterilen mevcut `PlanClosePrompt` akışı çalışmaya devam eder ve tamamlama mantığı iki akış arasında paylaşılır (kopyalanmaz).
- [ ] `.agent/PROJECT_DOCUMENT.md`, oturum bağlamının planlama oturumlarını da kapsadığını, console bilgi satırını ve elle tamamlama butonunu anlatacak şekilde güncellenir.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Yeni Next.js sürümü için gerekli olduğunda `node_modules/next/dist/docs/` altındaki ilgili rehber okunmalı; yeni GET route'u mevcut route dosyasının `RouteContext<"/api/projects/[id]/tasks/[taskId]">` ve `export const dynamic = "force-dynamic"` desenini izlemelidir.
- Tamamlama mantığı `use-plan-execution.ts` içinde tek bir yerde toplanmalı (ör. `completePlanAndTask({ planId, projectId, taskId, sessionId, isRunning })`); `confirmClose` ve yeni buton aynı fonksiyonu kullanmalıdır.
- Oturumu kapatırken: çalışan oturum için önce `{ type: "stop" }`, hemen ardından `{ type: "dismiss" }` mesajı gönderilir; zaten `exited` durumdaki oturum için yalnızca `dismiss` gönderilir. Sunucu "Stop a session before dismissing it." hatası dönerse bu hata mevcut hata bandına düşmeli, plan/task durumu geri alınmamalıdır.
- Başlık isteği yalnızca seçili oturumun bağlamı değiştiğinde yapılmalı, sonuç oturum kimliğine göre önbelleklenmeli ve `AbortController` ile iptal edilebilmelidir; bileşen unmount olduktan sonra `setState` çağrılmamalıdır.
- Bilgi ikonu için yeni bir küçük bileşen (ör. `src/app/console/session-info.tsx`) uygundur; mevcut Tailwind sınıf dili, `focus:ring-3 focus:ring-sky-100` odak stili ve slate/sky renk paleti korunmalıdır.
- Yeni ve dokunulan dosyalar 600 satır sınırının altında kalmalıdır; `agent-console.tsx` şu anda ~513 satırdır, bu yüzden bilgi satırı/buton mantığı ayrı dosyalara alınmalıdır.
- Tüm UI metinleri mevcut arayüzle tutarlı biçimde İngilizce yazılır (ör. "Complete task and plan", "Completing…"); yalnızca bu görev dosyasının anlatımı Türkçedir.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `pnpm dev` ile: bir task'tan plan başlat, konsolda `Task {No} - {başlık}` satırının ve bilgi ikonunda proje yolunun göründüğünü, tamamlama butonunun görünmediğini doğrula.
- [ ] `pnpm dev` ile: bir planı "Execute plan" ile çalıştır, `Plan {No}(Task {No}) - {başlık}` satırını gör, sayfayı yenileyip oturumu tekrar seçtiğinde satırın ve butonun hâlâ göründüğünü doğrula.
- [ ] "Task ve planı tamamla" butonuna bastıktan sonra `/plans` ve `/tasks` ekranlarında ilgili kayıtların `Completed` olduğunu ve oturumun konsol kenar çubuğundan kaybolduğunu doğrula.
