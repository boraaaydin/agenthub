# Konsolda prompt alanını terminalin altına taşı ve varsayılan olarak gizle

## Description

`/console` ekranındaki prompt formu şu anda terminalin **üstünde** duruyor ve her zaman
açık. Bu form aşağıya, terminal kartının **altına** alınacak ve varsayılan olarak
gizlenecek; kullanıcı bir düğmeyle istediğinde açıp kapatabilecek.

Çalışan bir oturuma bağlıyken kullanıcı zaten doğrudan terminale yazabildiği için prompt
alanı varsayılan olarak kapalı gelir. Yeni oturum durumunda (henüz seçili oturum yokken)
oturumu başlatmanın tek yolu bu form olduğundan alan otomatik olarak açık gelir. Tercih
kalıcı olarak saklanmaz; sayfa her yüklendiğinde bu varsayılan davranışa dönülür.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

- `src/app/console/agent-console.tsx` — konsolun tüm istemci durumu ve JSX düzeni burada.
  Bugünkü sıralama: yeni oturum / oturum başlığı bölümü → `<form onSubmit={submitPrompt}>`
  (prompt etiketi, `textarea`, yardım metni ve gönder düğmesi) → hata bandı (`role="alert"`)
  → `PlanClosePrompt` → terminal kartı (`SessionTerminal` ve başlık şeridi).
- Aynı dosyadaki ilgili durum ve yardımcılar:
  - `prompt` / `setPrompt` (`useState("")`) — form metni.
  - `newSession` ve `activeSession`; formun iki modu `newSession || !activeSession`
    (oturum başlat) ile çalışan oturuma prompt gönderme arasında ayrılıyor.
  - `canStart` / `canSend` — gönder düğmesinin etkinliği.
  - Mod değişimini tetikleyen yerler: ilk `onSessions` çağrısında var olan oturumun otomatik
    seçilmesi, `onStarted`, `selectSession`, `startNewSession`, `startSession` ve
    `onSessions` içindeki "aktif oturum kayboldu" dalı.
- `src/app/console/session-terminal.tsx` — xterm.js barındıran bileşen; klavye girdisini
  `onInput` ile doğrudan PTY'ye yazar, yani çalışan oturumda prompt formu olmadan da
  terminale yazılabilir.
- `src/app/console/use-plan-run.ts` ve `src/app/console/use-task-run.ts` — oturumu URL
  parametresinden program aracılığıyla `startSession(...)` ile başlatır; prompt formunu
  kullanmaz, bu yüzden formun gizli olması bu akışları etkilememelidir.
- Konsol arayüzündeki görünen metinler İngilizce; yeni düğme etiketi de İngilizce olmalı.
- Projede hazır bir açılır/kapanır (disclosure) bileşeni yok; `aria-expanded` /
  `aria-controls` kullanan mevcut bir örnek bulunmuyor, desen bu görevde kurulacak.

## Acceptance Criteria

- [ ] Prompt formu (etiket, `textarea`, durum metni ve gönder düğmesi) terminal kartının
      **altında** render edilir; terminal kartının üstünde prompt formu kalmaz.
- [ ] Hata bandı (`role="alert"`) ve `PlanClosePrompt` bugünkü konumlarında, terminal
      kartının üstünde kalır.
- [ ] Terminal kartının hemen altında, formu açıp kapatan bir düğme bulunur; düğme
      `aria-expanded` ve `aria-controls` ile form kapsayıcısına bağlıdır, klavyeyle
      erişilebilir ve ekranın diğer düğmeleriyle tutarlı bir odak halkası gösterir.
- [ ] Düğme etiketi duruma göre değişir (örneğin `Show prompt` / `Hide prompt`) ve İngilizcedir.
- [ ] Çalışan veya çıkmış bir oturum seçiliyken prompt alanı varsayılan olarak **kapalıdır**.
- [ ] Yeni oturum durumunda (`newSession || !activeSession`) prompt alanı varsayılan olarak
      **açık** gelir, böylece oturum tek adımda başlatılabilir.
- [ ] Kullanıcının açma/kapatma tercihi, mod değişene kadar korunur; mod değiştiğinde
      (oturum seçilince veya yeni oturum moduna geçilince) yukarıdaki varsayılana dönülür.
- [ ] Tercih `localStorage`, `sessionStorage`, çerez veya URL'de saklanmaz; sayfa yenilendiğinde
      varsayılan davranış geçerlidir.
- [ ] Alan kapalıyken `textarea` ve gönder düğmesi sekme (tab) sırasında yer almaz.
- [ ] Alanı kapatıp yeniden açmak, aynı mod içinde yazılmış prompt taslağını silmez.
- [ ] Alan düğmeyle açıldığında odak `textarea`'ya taşınır.
- [ ] Prompt gönderme davranışı değişmez: yeni oturumda `startSession`, çalışan oturumda
      `terminalSubmission` ile yapıştır + gönder akışı aynı kalır; `canStart` / `canSend`
      koşulları korunur.
- [ ] `usePlanRun` ve `useTaskRun` ile URL parametrelerinden başlatılan oturumlar, prompt alanı
      kapalıyken de eskisi gibi çalışır.
- [ ] Terminal kartı ve `SessionTerminal` boyutlandırması bozulmaz; alan açılıp kapandığında
      terminal `fit` davranışı hatalı bir düzen bırakmaz.
- [ ] `.agent/PROJECT_DOCUMENT.md` içindeki "Delivered session capabilities" bölümü, konsol
      prompt alanının terminalin altında olduğunu ve seçili oturumda varsayılan olarak gizli
      geldiğini belirtecek şekilde güncellenir.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalı.
- Değişiklik tek dosyada toplanabilir: `src/app/console/agent-console.tsx`. Form JSX'i
  terminal kartından sonraya taşınır ve bir `id`'li kapsayıcıya (`aria-controls` hedefi) alınır.
- Görünürlük için tek bir boolean durum yeterli, örneğin:
  ```tsx
  const isNewSessionMode = newSession || !activeSession;
  const [isPromptVisible, setIsPromptVisible] = useState(true);
  const previousModeRef = useRef(isNewSessionMode);
  if (previousModeRef.current !== isNewSessionMode) {
    previousModeRef.current = isNewSessionMode;
    setIsPromptVisible(isNewSessionMode);
  }
  ```
  Render sırasında durum ayarlama deseni, `useEffect` ile senkronlamaya göre bir kare
  gecikme/titreme bırakmaz; `useEffect` tercih edilirse aynı sonucu vermesi gerekir.
- Kapalıyken formu koşullu render etmek (`{isPromptVisible && (...)}`) `hidden`/`display:none`
  yaklaşımına yeğlenir; `prompt` metni üst bileşende tutulduğu için taslak yine korunur ve gizli
  odaklanabilir öğe kalmaz.
- Odak taşımak için `textarea`'ya bir `ref` verip düğmenin açma dalında `focus()` çağrılabilir;
  koşullu render ile birlikte `useEffect` içinde `isPromptVisible` true olduğunda odaklamak
  daha güvenilir olur. Sayfa ilk açılışında istem dışı odak kaymasına yol açmamalı.
- Terminal yüksekliği/`fit` davranışı `SessionTerminal` içinde yönetiliyor; alan açılıp
  kapandığında düzenin sıçramaması için terminal kartının kendi yüksekliğini koruduğundan
  emin olun.
- Stil olarak mevcut sınıflar kullanılmalı: düğme için ekrandaki ikincil düğme deseni
  (`h-10 rounded-xl border border-slate-300 bg-white ... focus:ring-3 focus:ring-sky-100`),
  form için bugünkü `textarea` ve gönder düğmesi sınıfları korunmalı.
- Sunucu tarafı, WebSocket protokolü, oturum kaydı ve prompt kompozisyonu bu görevde
  değiştirilmez.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: `http://localhost:3000/console` açıldığında oturum yokken prompt alanı açık gelir,
      prompt yazılıp oturum başlatıldığında alan kapanır ve terminalin altındaki düğmeyle
      yeniden açılabilir.
- [ ] Manuel: çalışan bir oturum seçiliyken alan kapalıdır; düğmeyle açılıp bir takip promptu
      gönderildiğinde çıktı terminale akar.
- [ ] Manuel: alan açıkken metin yazılıp kapatılıp yeniden açıldığında yazılan metin durur.
- [ ] Manuel: alan kapalıyken sekme (tab) ile gezildiğinde `textarea` ve gönder düğmesine
      odaklanılamaz; düğme `aria-expanded` değerini doğru bildirir.
- [ ] Manuel: sayfa yenilendiğinde alan, oturum seçiliyse kapalı, yeni oturum modundaysa açık gelir.
- [ ] Manuel: `/plans` üzerinden **Execute plan** ve bir görev detayından **Create plan** akışları
      konsolda eskisi gibi oturum başlatır.
