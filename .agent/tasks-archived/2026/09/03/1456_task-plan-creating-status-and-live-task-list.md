# Plan Creating Görev Statüsü ve Canlı Görev Listesi

## Description

Görev yaşam döngüsüne `plan_creating` ("Plan creating") statüsü eklenir. Bir görev için planlama oturumu başladığında görev bu statüye geçer, plan `POST /api/plans` ile kaydedildiğinde `plan_created` statüsüne ilerler. Her iki geçiş de `/tasks` listesine, mevcut `/api/agent-socket` WebSocket bağlantısı üzerinden anlık olarak yansıtılır; kullanıcı sayfayı yenilemek zorunda kalmaz. Planlama oturumu plan kaydedilmeden kapanırsa görev `open` statüsüne geri alınır.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

### Mevcut statü akışı

- Görev statüleri `src/lib/task-filters.ts` içindeki `TASK_STATUSES` dizisinde tanımlıdır: `open`, `plan_created`, `in_progress`, `completed`, `cancelled`. `ACTIVE_TASK_STATUSES`, `TERMINAL_TASK_STATUSES` dışındaki tüm statülerden otomatik türetilir; etiketler `TASK_STATUS_LABELS`, rozet sınıfları `TASK_STATUS_BADGE_CLASSES` içindedir.
- `src/lib/tasks-store.ts` içindeki `taskPatch`, `isTaskStatus` ile doğrulama yapar; yeni statü diziye eklendiğinde API doğrulaması ve görev detayındaki `<select>` (`src/app/projects/[id]/tasks/[taskId]/task-detail.tsx`, `TASK_STATUSES.map(...)`) otomatik olarak yeni değeri kapsar.
- `POST /api/plans` (`src/app/api/plans/route.ts`), plan kaydını oluşturduktan sonra görevi yalnızca `status === "open" || status === "in_progress"` ise `plan_created` yapar. **Bu koşul `plan_creating` içermediği için genişletilmelidir**; aksi hâlde plan kaydedildiğinde görev `plan_creating` statüsünde takılı kalır.
- Planlama oturumu `src/app/console/use-plan-run.ts` tarafından başlatılır: `GET /api/projects/{id}/tasks/{taskId}/plan-prompt` ile prompt alınır, ardından `startSession(agent, project, prompt, true, { projectId, taskId })` çağrılır. Bu istek şu an görev statüsüne hiç dokunmaz.
- Plan yürütme akışı (`src/app/console/use-plan-execution.ts`) statüyü istemciden `PATCH` ile güncellemenin mevcut kalıbını içerir (`beginExecution` → `executing`, `handleSessionExit` → `executed`); planlama akışı bu kalıbı izlemelidir.
- `GET`/`PATCH /api/projects/[id]/tasks/[taskId]` route'u mevcuttur ve tek görevi okuyup güncelleyebilir.

### Canlı güncelleme için mimari kısıtlar

- `/tasks` sayfası `export const dynamic = "force-dynamic"` ile işaretli bir sunucu bileşenidir; canlı güncelleme, sayfaya eklenecek küçük bir istemci bileşeninin `router.refresh()` çağırmasıyla sağlanır.
- **Plan kaydı tarayıcıdan gelmez.** `POST /api/plans` isteğini planlama agent'ı kendi `curl` komutuyla atar (bkz. `src/lib/task-plan.ts` içindeki `registerPlanPrompt`). Bu yüzden "Plan Created" bildirimi istemci tarafından tetiklenemez; olay **sunucu tarafında** üretilmek zorundadır.
- **`server.ts` görev store'unu doğrudan import edemez.** `src/lib/tasks-store.ts` dosyası `import "server-only"` ile başlar ve `server-only` paketi `node_modules` içinde kurulu değildir; bu takma ad yalnızca Next'in bundler'ı tarafından çözülür. `tsx` ile çalışan `server.ts` bu modülü import ederse çözümleme hatası alır.
- Next uygulaması ile WebSocket sunucusu **aynı Node süreci** içinde çalışır (`pnpm dev` tek bir `tsx watch server.ts` süreci başlatır; turbopack'in yan süreçleri yalnızca loader/postcss havuzlarıdır ve uygulama kodunu çalıştırmaz). Ancak Next route handler'ları Next'in kendi modül grafiğinde, `server.ts` ise doğrudan Node/tsx tarafından yüklenir; aynı dosya iki ayrı modül örneği olarak değerlendirilir. Bu nedenle paylaşılan olay veriyolu **`globalThis` üzerine sabitlenmelidir**.
- Mevcut WebSocket protokolü `src/lib/agent-protocol.ts` içindedir; `ServerMessage` birleşimi `server.ts` içindeki `broadcast()` ile tüm bağlı istemcilere yayınlanır. İstemci tarafı bağlantı kalıbı `src/app/console/use-agent-socket.ts` içindedir (protokol seçimi, `window.location.host`, 1 saniyelik yeniden bağlanma).

### Kullanıcı kararları

- Taşıyıcı: **mevcut WebSocket** (`/api/agent-socket`) genişletilir; SSE veya polling kullanılmaz.
- Tetikleyici: statü, **konsol oturumu başarıyla başladıktan sonra istemciden `PATCH` ile** yazılır; `plan-prompt` GET route'u yan etkisiz kalır.
- Plan kaydedilmeden oturum kapanırsa görev **`open` statüsüne geri alınır**.
- Canlı güncelleme kapsamı: **yalnızca `/tasks` listesi**. Görev detay sayfası ve `/plans` listesi bugünkü davranışını korur.

## Acceptance Criteria

### Statü

- [ ] `src/lib/task-filters.ts` içindeki `TASK_STATUSES` dizisine `plan_creating` değeri, `open` ile `plan_created` arasına eklenir; böylece statü filtresindeki ve görev detayındaki sıralama yaşam döngüsünü izler.
- [ ] `TASK_STATUS_LABELS` içinde `plan_creating` etiketi `Plan creating` olur ve `TASK_STATUS_BADGE_CLASSES` içinde `plan_created` rozetinden görsel olarak ayırt edilebilen bir sınıf tanımlanır (mevcut Tailwind paletiyle uyumlu).
- [ ] `plan_creating`, `TERMINAL_TASK_STATUSES` dışında kaldığı için `ACTIVE_TASK_STATUSES` içinde otomatik yer alır; `/tasks` sayfasının varsayılan "active" filtresinde bu statüdeki görevler listelenir ve statü filtresinde seçilebilir.
- [ ] `POST /api/plans`, görevi `plan_created` yapan koşulu `plan_creating` statüsünü de kapsayacak şekilde genişletir; `completed`, `cancelled` ve zaten `plan_created` olan görevler değiştirilmeden kalır.

### Sunucu tarafı olay veriyolu ve WebSocket yayını

- [ ] `server-only` içermeyen yeni bir modül (ör. `src/lib/task-events.ts`) görev değişikliği olaylarını yayınlar ve dinler. Veriyolu tekil örneği `globalThis` üzerinde saklanır, böylece Next modül grafiği ile `server.ts` aynı örneği paylaşır ve dev modundaki yeniden derlemeler ikinci bir veriyolu oluşturmaz.
- [ ] Modül, dış bağımlılık gerektirmeyen basit bir dinleyici koleksiyonu sunar (ör. `publishTaskChange(change)` ve aboneliği sonlandıran bir fonksiyon döndüren `subscribeToTaskChanges(listener)`); bir dinleyicinin fırlattığı hata diğer dinleyicileri veya çağıran isteği etkilemez.
- [ ] `src/lib/tasks-store.ts` içindeki `updateTask`, başarılı bir yazma işleminden sonra `{ projectId, taskId, status }` bilgisini yayınlar. Böylece hem `PATCH /api/projects/[id]/tasks/[taskId]` hem de `POST /api/plans` içindeki statü geçişi tek bir noktadan duyurulur; iki çağrı yerinde kod tekrarı yapılmaz.
- [ ] `src/lib/agent-protocol.ts` içindeki `ServerMessage` birleşimine görev değişikliğini taşıyan yeni bir mesaj eklenir (ör. `{ type: "task-changed"; projectId: string; taskId: number; status: TaskStatus }`). `ClientMessage` ve `isClientMessage` değişmez; mesaj yalnızca sunucudan istemciye akar.
- [ ] `server.ts`, başlangıçta veriyoluna abone olur ve gelen her görev değişikliğini mevcut `broadcast()` yardımıyla tüm bağlı istemcilere yayınlar; abonelik kapanışta (`shutdown`) sonlandırılır.
- [ ] `server.ts` hiçbir `server-only` modülünü (özellikle `src/lib/tasks-store.ts`) import etmez ve `pnpm dev` çözümleme hatası vermeden başlar.

### `/tasks` listesinin canlı güncellenmesi

- [ ] `/tasks` sayfasına, WebSocket bağlantısını kuran ve `task-changed` mesajı geldiğinde `router.refresh()` çağıran küçük bir istemci bileşeni eklenir (ör. `src/app/tasks/task-live-updates.tsx`); bileşen görünür bir arayüz öğesi getirmez ve sayfanın sunucu tarafında işlenmesini değiştirmez.
- [ ] Bileşen `use-agent-socket.ts` ile aynı bağlantı kalıbını kullanır: `ws:`/`wss:` seçimi, `window.location.host`, bağlantı koptuğunda yeniden bağlanma ve unmount sırasında soketin kapatılması.
- [ ] Kısa aralıkla gelen birden çok olay tek bir yenilemede toplanır (küçük bir debounce) ve `task-changed` dışındaki mesaj tipleri sessizce yok sayılır.
- [ ] Bağlantı yeniden kurulduğunda bir kez `router.refresh()` çağrılır; böylece bağlantının kopuk olduğu sürede kaçırılan değişiklikler listeye yansır.
- [ ] Liste bir proje veya statü filtresiyle görüntülenirken de yenileme çalışır; mevcut sayfa, filtre ve sayfalama parametreleri korunur.
- [ ] Konsolda planlama oturumu başlatıldığında, başka bir sekmede açık olan `/tasks` listesi elle yenilenmeden görevi `Plan creating` rozetiyle gösterir; agent planı kaydettiğinde aynı liste elle yenilenmeden `Plan created` rozetine geçer.

### Konsol tarafı statü geçişleri

- [ ] `src/app/console/use-plan-run.ts`, `startSession` başarıyla döndükten sonra `PATCH /api/projects/{projectId}/tasks/{taskId}` ile görevi `plan_creating` statüsüne alır. Prompt isteği veya oturum başlatma başarısız olursa statü değiştirilmez.
- [ ] Statü güncellemesi başarısız olursa planlama oturumu çalışmaya devam eder ve kullanıcı mevcut hata bandında bilgilendirilir; oturum sonlandırılmaz.
- [ ] Konsol, planlama oturumlarını (bağlamında `taskId` olan ancak `planId` olmayan oturumlar) izler. İzleme hem oturum başlangıcında (`onStarted`) hem de sunucudan gelen oturum listesinden (`onSessions`) beslenir; böylece sayfa yenilendikten sonra da oturum tanınır.
- [ ] İzlenen bir planlama oturumu sona erdiğinde (`exit`) konsol görevi okur ve statüsü hâlâ `plan_creating` ise `open` statüsüne geri alır. Statü `plan_created` veya başka bir değere geçmişse hiçbir değişiklik yapılmaz.
- [ ] Geri alma isteği başarısız olduğunda kullanıcı hata bandında bilgilendirilir; istek `AbortController` ile iptal edilebilir ve bileşen unmount olduktan sonra durum güncellemesi yapılmaz.
- [ ] Aynı oturumun çıkışı için geri alma en fazla bir kez denenir (mevcut `exitHandled` kalıbına benzer bir koruma).

### Dokümantasyon

- [ ] `.agent/PROJECT_DOCUMENT.md`, yeni `plan_creating` statüsünü, statünün yaşam döngüsündeki yerini ve `/tasks` listesinin WebSocket üzerinden anlık güncellendiğini anlatacak şekilde güncellenir (görev statülerinin sayıldığı satır ve "Delivered session capabilities" bölümü).

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Next.js sürümü çoğu agent'ın eğitim verisinden yenidir; gerekli olduğunda `node_modules/next/dist/docs/` altındaki ilgili rehber okunmalıdır.
- Olay veriyolu modülü `server.ts` tarafından göreli yol (`./src/lib/task-events`), Next tarafından ise `@/lib/task-events` ile import edilecektir; `src/lib/agent-protocol.ts` zaten bu şekilde iki taraftan kullanılmaktadır. Modül `server-only` import etmemeli ve tarayıcı derlemesine sızmamalıdır.
- `globalThis` sabitlemesi için tipli bir yardımcı kullanılmalıdır (ör. `globalThis` üzerinde `Symbol.for("agenthub.taskEvents")` anahtarı ya da `declare global` ile tanımlanmış bir alan); `??=` ile yalnızca ilk yüklemede oluşturulmalıdır.
- Olay yayını `updateTask` içinde, dosyaya yazma tamamlandıktan sonra yapılmalıdır. Yayınlama isteği bloklamamalı; olası bir dinleyici hatası `try/catch` ile yutulmalıdır.
- Görev oluşturma ve silme olayları bu görevin kapsamı dışındadır; yalnızca statü/alan güncellemeleri yayınlanır.
- Görevi `plan_creating` yapan `PATCH` isteği, `use-plan-execution.ts` içindeki `updatePlanStatus` ile aynı yapıdadır (JSON gövde, `AbortController`, hata gövdesinden mesaj okuma). Ortak yardımcıya çıkarmak yerine yeni hook içinde aynı kalıbı izlemek yeterlidir.
- Planlama oturumu takibi için `use-plan-execution.ts` ile karışmayan ayrı bir hook önerilir (ör. `src/app/console/use-plan-creation.ts`). `agent-console.tsx` içindeki `onStarted` ve `onExit` geri çağrımları hem plan yürütme hem de planlama hook'unu çağırmalıdır.
- Planlama oturumları `autoClose: true` ile başlatılır ve `SessionRegistry`, oturumu `exit` yayınından **önce** haritadan siler. Bu nedenle çıkış anında oturumun bağlamı sunucudan gelen güncel listeden okunamayabilir; bağlam, oturum izlenmeye başlandığı anda istemci tarafında saklanmalıdır.
- Geri alma kararı istemcinin kendi belleğine değil, `GET /api/projects/{id}/tasks/{taskId}` ile okunan güncel statüye dayanmalıdır; agent'ın `POST /api/plans` isteği ile oturum çıkışı arasında yarış durumu vardır.
- Tüm kullanıcıya görünen arayüz metinleri mevcut arayüzle tutarlı biçimde İngilizce yazılır ("Plan creating"); yalnızca bu görev dosyasının anlatımı Türkçedir.
- `plan_creating` statüsündeki görevlerde `src/app/tasks/task-status-button.tsx` bugünkü koşulu gereği "Complete" butonunu göstermez. Planlama sürerken bu davranış kasıtlı olarak korunur; buton koşulu değiştirilmemelidir.
- Dokunulan dosyalar 600 satır sınırının altında kalmalıdır; `agent-console.tsx` bu sınıra yakındır, bu yüzden yeni mantık ayrı hook/bileşen dosyalarına alınmalıdır.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `pnpm dev` ile: bir tarayıcı sekmesinde `/tasks` listesini açık tut, ikinci sekmede bir görev için "Create plan" ile planlama oturumu başlat; `/tasks` sekmesi elle yenilenmeden görevin `Plan creating` rozetine geçtiğini doğrula.
- [ ] Planlama agent'ı `POST /api/plans` ile planı kaydettiğinde `/tasks` sekmesinin elle yenilenmeden `Plan created` rozetine geçtiğini doğrula.
- [ ] `/tasks` listesi bir proje veya statü filtresiyle açıkken aynı canlı güncellemenin çalıştığını ve filtre/sayfalama parametrelerinin korunduğunu doğrula.
- [ ] Planlama oturumunu plan kaydedilmeden sonlandır (agent'ı durdur veya çıkışını bekle) ve görevin `open` statüsüne geri döndüğünü, listenin bunu anlık yansıttığını doğrula.
- [ ] `/tasks` sekmesi açıkken sunucuyu yeniden başlat; WebSocket yeniden bağlandığında listenin bir kez yenilendiğini ve sayfanın hata vermediğini doğrula.
- [ ] Görev detay sayfasındaki statü listesinde `Plan creating` seçeneğinin göründüğünü ve elle seçildiğinde kaydedildiğini doğrula.
