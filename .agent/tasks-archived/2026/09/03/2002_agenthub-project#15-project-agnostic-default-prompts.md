# Yerleşik promptlardaki sabit proje adını değişkene çevir

## Description

`src/lib/default-prompts/` altındaki dört yerleşik prompt, AgentHub'ın kendi deposuna
sabitlenmiş proje adı içeriyor. AgentHub başka projeleri de yönettiği için, farklı bir projede
planlama veya görev çalıştırıldığında ajan yanlış uygulama adını kullanıyor: task şablonuna
`Root application (`agenthub`)` yazıyor, arşiv dosyasını `..._agenthub_...` önekiyle
oluşturuyor ve kontrol adımlarında "root `agenthub` application" arıyor.

Prompt metinlerindeki sabit proje adı yerine `{{PROJECT_NAME}}` ve `{{PROJECT_SLUG}}`
placeholder tokenları kullanılacak; bu tokenlar prompt derlenirken
(`composePlanPrompt` / `composeTaskPrompt`) oturumun ait olduğu projenin kaydından çözülecek.
Tokenlar Markdown dosyalarının içinde durduğu için, kullanıcı `/settings` ekranından kendi
promptunu kaydettiğinde de aynı tokenları kullanabilecek ve aynı şekilde çözülecek.

Ayrıca prompt metinlerinde "AgentHub" kelimesinin **üzerinde çalışılan proje** anlamına gelecek
şekilde okunduğu cümleler yeniden yazılacak; AgentHub'ın oturumu yürüten araç olduğu
cümleler (plan kaydı, yerel task akışı, CLI oturumunun kapatılması) olduğu gibi kalacak.

Kapsam dışı: `pnpm build` / `pnpm lint` komutları bu görevde **değiştirilmiyor**. Doğrulama
komutlarının projeye göre değişmesi ayrı bir iş; proje kaydında bu komutlar için bir alan yok
ve bu görevde eklenmiyor.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Sabit proje adı geçen yerler:

- `src/lib/default-prompts/plan.md`
  - satır 3: "You are the planning agent for AgentHub." — burada AgentHub, üzerinde çalışılan
    proje gibi okunuyor.
  - satır 17: task şablonunun `## Application` bölümü — `Root application (`agenthub`)`.
- `src/lib/default-prompts/plan-post.md`
  - satır 3: "You are the planning close-out agent for AgentHub."
  - satır 6: "names the root `agenthub` application".
  - satır 11: "Use AgentHub's local task workflow only:" — bu, aracın akışı; kalacak.
  - satır 17: "so the AgentHub session closes" — bu da araç; kalacak.
- `src/lib/default-prompts/task.md`
  - satır 3: "You are the execution agent for AgentHub."
  - satır 21: "AgentHub's local task queue and archive" — araç; kalacak.
- `src/lib/default-prompts/task-post.md`
  - satır 3: "You are the completion agent for AgentHub."
  - satır 11: arşiv yolu `.agent/tasks-archived/{YYYY}/{MM}/{DD}/{HHMM}_agenthub_{filename}`.
  - satır 17: "Use only AgentHub's project task structure." — araç; kalacak.
- `src/lib/task-plan.ts` satır 16: kod içinde tanımlı `PLAN_LANGUAGE_SECTION`, İngilizce
  kalması gereken parçalar arasında "the `Root application (`agenthub`)` line" diyor.

Derleme (compose) tarafındaki mevcut yapı:

- `src/lib/task-plan.ts` — client-safe. `composePlanPrompt(options)` bölümleri `\n\n---\n\n`
  ile şu sırada birleştiriyor: etkin plan promptu, `## Task #{id}: {title}` bölümü,
  kod içinde tanımlı `PLAN_LANGUAGE_SECTION`, etkin after-planning promptu ve `plansEndpoint`
  verildiğinde `registerPlanPrompt(...)` ile üretilen `## Register the plan in AgentHub` bölümü.
  Seçenekler bugün `projectId` alıyor ama `projectName` / `projectPath` almıyor.
- `src/lib/task-run.ts` — client-safe. `composeTaskPrompt(options)` etkin task promptunu,
  `## Task file` bölümünü ve etkin after-task promptunu birleştiriyor. Bugün hiçbir proje
  alanı almıyor.
- `src/app/api/projects/[id]/tasks/[taskId]/plan-prompt/route.ts` — `composePlanPrompt`'un tek
  çağıranı. `project` kaydını zaten okuyor ve yanıtında `projectName` ile `projectPath`
  döndürüyor, yani her iki değer de elinde.
- `src/app/api/plans/[planId]/task-prompt/route.ts` — `composeTaskPrompt`'un tek çağıranı.
  Bu da `project` kaydını okuyor ve `projectName` / `projectPath` döndürüyor.
- Her iki route'taki `effectivePrompt(...)` yardımcıları, kayıtlı prompt boşsa
  `readDefaultSettingsPrompt(field)` ile `src/lib/default-prompts/` altındaki Markdown'ı
  okuyor. Yani token değişimi hem yerleşik hem kullanıcı promptu için aynı yoldan geçmeli.
- `src/lib/projects-store.ts` — `Project` tipi: `id`, `name`, `path`, `createdAt`, `color?`.
  Slug için hazır bir alan yok; `name` ve `path` üzerinden türetilecek.
- `src/app/settings/prompts/prompt-form.tsx` — prompt düzenleme formu. `prompt.description`
  altında `isUsingDefault` durumunda gösterilen kısa bir yardım metni bloğu var; token
  listesi için doğal yer burası.
- `.agent/PROJECT_DOCUMENT.md` satır 63 (yerleşik promptların okunması), satır 134/138
  (`src/lib/` ağacı) ve satır 164 (dil kuralı, "the `Root application (`agenthub`)` line"
  ifadesiyle) bu değişiklikten etkileniyor.

## Acceptance Criteria

- [ ] Yeni, client-safe bir modül (`src/lib/prompt-tokens.ts`) proje adından slug türeten ve
      prompt metnindeki tokenları değiştiren fonksiyonları dışa aktarır; `server-only` import
      etmez, Node built-in kullanmaz ve 600 satırın altındadır.
- [ ] Desteklenen token seti tam olarak ikidir: `{{PROJECT_NAME}}` (projenin kayıtlı adı,
      olduğu gibi) ve `{{PROJECT_SLUG}}` (türetilmiş kebab-case tanımlayıcı).
- [ ] Slug türetme: küçük harfe çevirir, aksanları/birleşik işaretleri ayıklar (`ö→o`, `ü→u`,
      `ç→c`, `ğ→g`, `ş→s`, `ı→i`, `İ→i`), `a-z0-9` dışındaki her karakteri `-` yapar, art arda
      gelen `-` karakterlerini teke indirir ve baştaki/sondaki `-` karakterlerini atar.
- [ ] Proje adından üretilen slug boş kalırsa proje yolunun son dizin adı slug'lanarak
      kullanılır; o da boş kalırsa `project` kullanılır.
- [ ] Token değişimi yalnızca ayarlardan gelen dört prompt metnine uygulanır (`planPrompt`,
      `planPostPrompt`, `taskPrompt`, `taskPostPrompt`) — kayıtlı metin de yerleşik Markdown
      varsayılanı da aynı şekilde işlenir.
- [ ] Token değişimi task başlığı/detayı, plan başlığı/özeti, `filePath` ve kod içinde
      tanımlı bölümlere (`## Task #...`, `## Task file`, `## Register the plan in AgentHub`)
      uygulanmaz; kullanıcı metnindeki `{{...}}` benzeri diziler olduğu gibi kalır.
- [ ] Tanınmayan tokenlar (ör. `{{FOO}}`) silinmez veya boşaltılmaz; metinde olduğu gibi kalır.
- [ ] `composePlanPrompt` seçeneklerine `projectName` ve `projectPath` eklenir ve plan/after-plan
      prompt bölümleri token değişiminden geçirilir; `planConsoleHref` değişmez.
- [ ] `composeTaskPrompt` seçeneklerine `projectName` ve `projectPath` eklenir ve task/after-task
      prompt bölümleri token değişiminden geçirilir; `taskConsoleHref` değişmez.
- [ ] `src/lib/task-plan.ts` içindeki `PLAN_LANGUAGE_SECTION` artık sabit `agenthub` adını
      içermez; çözülmüş slug ile ``Root application (`{slug}`)`` satırına atıf yapar ve kuralın
      geri kalanı (başlıklar, dosya adı, yollar, komutlar, kod tanımlayıcıları İngilizce kalır)
      korunur.
- [ ] `src/lib/default-prompts/plan.md`: `## Application` bölümü ``Root application
      (`{{PROJECT_SLUG}}`)`` olur; açılış cümlesi AgentHub'ı oturumu yürüten araç olarak
      tanımlar ve üzerinde çalışılan projeyi `{{PROJECT_NAME}}` ile adlandırır.
- [ ] `src/lib/default-prompts/plan-post.md`: 2. adımdaki "root `agenthub` application" kontrolü
      `{{PROJECT_SLUG}}` üzerinden yapılır; açılış cümlesi aynı şekilde düzeltilir; 11. ve 17.
      satırlardaki araç anlamındaki AgentHub ifadeleri korunur.
- [ ] `src/lib/default-prompts/task.md`: açılış cümlesi düzeltilir; 21. satırdaki araç
      anlamındaki AgentHub ifadesi korunur.
- [ ] `src/lib/default-prompts/task-post.md`: arşiv yolu
      `.agent/tasks-archived/{YYYY}/{MM}/{DD}/{HHMM}_{{PROJECT_SLUG}}_{filename}` olur; açılış
      cümlesi düzeltilir; 17. satırdaki araç anlamındaki AgentHub ifadesi korunur.
- [ ] Dört Markdown dosyasında da `pnpm build` / `pnpm lint` satırları ve GitHub issue yasağıyla
      ilgili ifadeler değişmeden kalır.
- [ ] `src/app/settings/prompts/prompt-form.tsx`, prompt metin alanının üstünde kullanılabilir
      tokenları (`{{PROJECT_NAME}}`, `{{PROJECT_SLUG}}`) ve derleme sırasında değiştirildiklerini
      belirten tek satırlık bir yardım metni gösterir; bu metin hem kayıtlı hem varsayılan
      promptta görünür.
- [ ] `GET /api/projects/{projectId}/tasks/{taskId}/plan-prompt` ve
      `GET /api/plans/{planId}/task-prompt` yanıt şekilleri, alan adları ve hata mesajları
      değişmez; yalnızca `prompt` içeriğinde tokenlar çözülmüş olur.
- [ ] `data/projects.json`, `data/settings.json` ve `Project` / `Settings` tiplerinde alan
      eklenmez veya değiştirilmez.
- [ ] `.agent/PROJECT_DOCUMENT.md` güncellenir: yerleşik promptların proje tokenları taşıdığı ve
      derleme sırasında çözüldüğü belirtilir, `src/lib/` ağacına `prompt-tokens.ts` eklenir ve
      satır 164'teki dil kuralı sabit `agenthub` adı yerine ``Root application`` satırından
      genel olarak söz eder.

## Technical Notes

- Uygulamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalı.
- Önerilen modül şekli (`src/lib/prompt-tokens.ts`):

  ```ts
  export type ProjectPromptTokens = { projectName: string; projectPath: string };

  export function projectSlug({ projectName, projectPath }: ProjectPromptTokens): string;
  export function applyPromptTokens(text: string, project: ProjectPromptTokens): string;
  ```

  `applyPromptTokens`, yalnızca bilinen tokenları değiştiren tek bir `replaceAll` zinciri ya da
  bilinen anahtarlarla sınırlı bir `replace(/\{\{(PROJECT_NAME|PROJECT_SLUG)\}\}/g, ...)`
  kullanmalı; genel `\{\{\w+\}\}` yakalayıp bilinmeyeni boşaltmamalı.
- `ı` (U+0131) Unicode normalizasyonuyla ayrışmaz; `normalize("NFD")` + birleşik işaret
  ayıklamasına ek olarak açık bir eşleme gerekir.
- Token değişimini composer içinde, prompt bölümü `trim()` edildikten sonra uygulamak yeterli;
  route'larda ayrıca metin işlemeye gerek yok. Route'lar sadece `projectName` ve `projectPath`
  değerlerini composer'a geçirir.
- `src/lib/task-plan.ts` ve `src/lib/task-run.ts` client-safe kalmalı (`server-only` importu
  veya Node built-in kullanımı yok).
- Prompt metinleri İngilizce yazılmaya devam eder; bu görev yalnızca sabit proje adını
  değişkene çevirir ve araç/proje ayrımını netleştirir.
- `src/lib/default-settings-prompts.ts` değişmez; token'lı Markdown'ı olduğu gibi okumaya
  devam eder ve `/settings` ekranında tokenlar ham haliyle görünür (istenen davranış budur).
- Proje kaydına build/lint komut alanı eklenmez; bu görevin kapsamı dışındadır.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manuel: adı Türkçe karakter içeren bir proje kaydedin (ör. "Ödeme Ağı"), o projede bir task
      oluşturun ve `curl -s "http://localhost:3000/api/projects/{projectId}/tasks/{taskId}/plan-prompt"`
      yanıtındaki `prompt` içinde ``Root application (`odeme-agi`)`` göründüğünü, hiçbir yerde
      `agenthub` veya çözülmemiş `{{PROJECT_SLUG}}` kalmadığını doğrulayın.
- [ ] Manuel: aynı projede kayıtlı bir plan için
      `curl -s "http://localhost:3000/api/plans/{planId}/task-prompt"` çağırın ve arşiv yolu
      örneğinin `{HHMM}_odeme-agi_{filename}` biçiminde çözüldüğünü doğrulayın.
- [ ] Manuel: `/settings` altında bir prompt açın, token yardım metnini görün, içinde
      `{{PROJECT_NAME}}` geçen özel bir prompt kaydedin ve yukarıdaki iki endpoint'in bu tokenı da
      proje adıyla değiştirdiğini doğrulayın.
- [ ] Manuel: prompt metnine `{{FOO}}` ekleyip kaydedin ve derlenmiş `prompt` içinde `{{FOO}}`
      ifadesinin olduğu gibi kaldığını doğrulayın.
- [ ] Manuel: başlığında `{{PROJECT_SLUG}}` geçen bir task oluşturun ve derlenmiş prompt'un
      `## Task #{id}` bölümünde bu metnin değiştirilmediğini doğrulayın.
