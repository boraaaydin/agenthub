# Console "Complete task" Butonu: Agent Çalışırken Devre Dışı

## Description

Console ekranında plan yürütme oturumlarında görünen tamamlama butonunun etiketini "Complete task and plan" yerine "Complete task" olarak kısalt ve butonu yalnızca agent çalışması durduğunda (oturum `exited`) etkin hâle getir. Oturum `starting` veya `running` durumundayken buton devre dışı olmalı, agent çıktığı anda ek bir kullanıcı işlemi gerekmeden etkinleşmelidir.

## Application

Root application (`agenthub-project`)

## Dependencies

`console-complete-task-and-plan-button.md` - Bu görevde değiştirilen buton (`src/app/console/plan-completion-action.tsx`) ve `completePlanAndTask` akışı o görevle eklenmiştir. Önce o görev tamamlanmalı, bu görev sonra uygulanmalıdır.

## Context

- Buton bileşeni `src/app/console/plan-completion-action.tsx` içindedir. Şu anda yalnızca `isCompleting` ve `onComplete` proplarını alır; `disabled={isCompleting}` ile devre dışı kalır ve etiketi `isCompleting ? "Completing…" : "Complete task and plan"` şeklindedir.
- Buton `src/app/console/agent-console.tsx` içinde, terminal kartının altındaki "Show prompt" butonunun yanında, yalnızca `activeSession?.execution?.planId` varken render edilir (`<PlanCompletionAction isCompleting={isCompleting} onComplete={completeActivePlan} />`).
- Oturum durumu `SessionState = "starting" | "running" | "exited"` olarak `src/lib/agent-protocol.ts` içinde tanımlıdır ve seçili oturumda `activeSession.state` üzerinden okunur. `agent-console.tsx` bu değeri başka yerlerde de kullanır (ör. "Stop session" butonu yalnızca `running` durumunda görünür).
- `agent-console.tsx` içindeki `completeActivePlan`, `completePlanAndTask`'e `isRunning: activeSession.state === "running"` gönderir; `closeCompletedSession` çalışan oturumu önce `stop`, sonra `dismiss` eder. Buton artık yalnızca `exited` oturumda basılabilir olacağı için bu yol pratikte çalışmayan oturumu kapatır; `completePlanAndTask` ve `closeCompletedSession` imzaları değişmemelidir, çünkü aynı mantık `use-plan-execution.ts` içindeki `confirmClose` (agent çıktıktan sonra gösterilen `PlanClosePrompt`) akışında da paylaşılır.
- Agent çıktıktan sonra gösterilen `PlanClosePrompt` (`src/app/console/plan-close-prompt.tsx`) ayrı bir akıştır ve bu görevde değişmez; etiketleri ("Complete plan and task") olduğu gibi kalır.
- `.agent/PROJECT_DOCUMENT.md`'nin "Delivered session capabilities" bölümü butonu **Complete task and plan** adıyla ve "stops a running session" davranışıyla anlatır; bu açıklama yeni davranışla uyumsuz kalacaktır.
- Tüm arayüz metinleri İngilizcedir; yalnızca bu görev dosyasının anlatımı Türkçedir.

## Acceptance Criteria

- [ ] Butonun etiketi tamamlama işlemi sürmezken "Complete task" olur; işlem sürerken mevcut "Completing…" etiketi korunur.
- [ ] `PlanCompletionAction`, oturumun çalışıp çalışmadığını bildiren yeni bir prop alır (ör. `isSessionRunning` veya `canComplete`) ve buton `disabled` durumu hem bu bilgiyi hem de `isCompleting` değerini birlikte değerlendirir.
- [ ] Seçili plan yürütme oturumu `starting` veya `running` durumundayken buton devre dışıdır ve tıklama tamamlama akışını başlatmaz.
- [ ] Oturum `exited` durumuna geçtiğinde buton, sayfa yenilemeye veya oturumu yeniden seçmeye gerek kalmadan etkinleşir.
- [ ] Buton devre dışıyken görsel olarak da devre dışı görünür (mevcut `disabled:cursor-not-allowed disabled:bg-slate-300` stilleri korunur) ve neden devre dışı olduğunu açıklayan erişilebilir bir metin taşır (ör. agent çalışırken `title` ile "The agent is still running." benzeri kısa bir açıklama).
- [ ] Buton, önceki davranıştaki gibi yalnızca `activeSession?.execution?.planId` olan oturumlarda görünmeye devam eder; başka oturum türlerinde görünmez.
- [ ] Tamamlama akışının kendisi (plan `completed` → task `completed` → oturumu kapat) ve hata mesajları değişmez; `completePlanAndTask` ile `PlanClosePrompt` akışı çalışmaya devam eder.
- [ ] `.agent/PROJECT_DOCUMENT.md`, butonun yeni adını ("Complete task") ve yalnızca agent çalışması durduktan sonra etkin olduğunu yansıtacak şekilde güncellenir.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Durum hesaplaması `agent-console.tsx` içinde yapılmalı (`activeSession.state !== "exited"`), bileşen içinde `SessionSummary` tipine bağımlılık oluşturmadan basit bir boolean prop olarak geçilmelidir; böylece `plan-completion-action.tsx` sunum bileşeni olarak kalır.
- `completeActivePlan` içindeki `isRunning: activeSession.state === "running"` ifadesi olduğu gibi bırakılabilir; buton yalnızca `exited` durumda basılabildiği için değer `false` olur, ancak paylaşılan `completePlanAndTask` imzası korunmuş olur.
- Mevcut Tailwind sınıf dili, `focus:ring-3 focus:ring-sky-100` odak stili ve slate/sky renk paleti korunmalıdır.
- Dokunulan dosyalar 600 satır sınırının altında kalmalıdır.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `pnpm dev` ile: bir planı "Execute plan" ile çalıştır; agent çalışırken terminalin altındaki "Complete task" butonunun devre dışı olduğunu ve tıklamanın hiçbir şey yapmadığını doğrula.
- [ ] Aynı oturumda agent çıktıktan sonra butonun etkinleştiğini, tıklandığında plan ve task kayıtlarının `/plans` ve `/tasks` ekranlarında `Completed` olduğunu ve oturumun kenar çubuğundan kaldırıldığını doğrula.
- [ ] Planlama oturumunda (planId taşımayan) butonun hiç görünmediğini doğrula.
