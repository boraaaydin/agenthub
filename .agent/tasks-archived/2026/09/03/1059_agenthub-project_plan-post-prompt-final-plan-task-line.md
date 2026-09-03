# Plan Kapanışında Plan ve Task Numarası Satırı

## Description

Yerleşik "After planning prompt" (`src/lib/default-prompts/plan-post.md`) planlama ajanına, oturumu kapatmadan hemen önce bilgilendirme amaçlı tek bir özet satırı yazdırmayı söylesin. Bu satır plan numarasını, task numarasını ve task başlığını içersin ve ajanın ekrana bastığı en son çıktı olsun.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

- Planlama prompt'u `composePlanPrompt` (`src/lib/task-plan.ts`) tarafından şu sırayla birleştirilir: task planlama prompt'u → `## Task #{taskId}: {taskTitle}` bölümü → `## Plan language` bölümü → after-planning prompt'u → `## Register the plan in AgentHub` bölümü.
- Task numarası ve task başlığı, after-planning prompt'unun üstünde yer alan `## Task #{taskId}: {taskTitle}` başlığında zaten mevcuttur; ajan bunları oradan okuyabilir.
- Plan numarası yalnızca kayıt sonrasında bilinir: `POST /api/plans` başarılı olduğunda 201 döner ve gövdesinde tamsayı `id` alanı bulunur (`src/app/api/plans/route.ts`, `src/lib/plans-store.ts`). Bu id, `/plans` ekranlarındaki plan numarasıdır.
- `## Register the plan in AgentHub` bölümü, kaydın "CLI sürecini sonlandırmadan önce" yapılmasını söyler. Dolayısıyla doğru sıra: kaydı yap → özet satırını yaz → süreci sonlandır.
- Mevcut `plan-post.md` dosyasının 6. maddesi hem final raporu istemekte hem de son eylem olarak `kill -TERM $PPID` ile sürecin kapatılmasını söylemektedir. Yeni özet satırı bu kapatmadan önce gelmelidir.
- Ayarlar ekranı, kayıtlı bir prompt yoksa yerleşik varsayılanı soluk metinle gösterir (`src/lib/default-settings-prompts.ts`). Bu nedenle değişiklik yalnızca kendi after-planning prompt'unu kaydetmemiş kullanıcılar için geçerlidir; bu bilinçli bir tercihtir ve bu task kapsamında kod tarafına ek bir bölüm eklenmeyecektir.
- Yerleşik varsayılan prompt'lar İngilizce yazılmıştır; bu dosyanın metni de İngilizce kalmalıdır.

## Acceptance Criteria

- [ ] `src/lib/default-prompts/plan-post.md`, plan kaydından sonra ve CLI süreci sonlandırılmadan önce oturum çıktısına (terminale) tek satırlık bir özet yazdırmayı açıkça talimatlandırır; bu satır için hiçbir dosya oluşturulmaz veya değiştirilmez.
- [ ] Özet satırının biçimi promptta birebir gösterilir: `Plan #<planId> · Task #<taskId>: <task title>`.
- [ ] Prompt, `<planId>` değerinin `POST /api/plans` çağrısının 201 yanıtındaki `id` alanından alınacağını belirtir.
- [ ] Prompt, `<taskId>` ve `<task title>` değerlerinin prompt içindeki `## Task #{id}: {title}` bölümünden alınacağını belirtir.
- [ ] Prompt, kayıt 201 dönmediğinde plan numarası yerine kaydın yapılamadığını belirten bir metin yazılacağını söyler (örneğin `Plan #not-registered`), satır yine de yazdırılır.
- [ ] Prompt, bu satırın ajanın en son çıktısı olduğunu ve `kill -TERM $PPID` (veya CLI'nin kendi çıkış komutu) adımının ondan sonra geldiğini netleştirir.
- [ ] Dosyadaki mevcut `{{PROJECT_NAME}}` ve `{{PROJECT_SLUG}}` token'ları ile 1-5. maddeler, GitHub issue yasağı ve yerel task akışı bölümleri korunur.
- [ ] `.agent/PROJECT_DOCUMENT.md` içindeki, planlama prompt'unun `POST /api/plans` ile bittiğini söyleyen cümle, kayıttan sonra bir özet satırının yazdırıldığını da yansıtacak şekilde güncellenir.

## Technical Notes

- Uygulamaya başlamadan önce `.agent/PROJECT_DOCUMENT.md` okunmalıdır.
- Değişiklik yalnızca `src/lib/default-prompts/plan-post.md` (ve `.agent/PROJECT_DOCUMENT.md` içindeki tek cümle) üzerinde yapılır. `src/lib/task-plan.ts`, `src/lib/settings-prompts.ts`, API route'ları veya konsol bileşenleri değiştirilmez.
- Yeni talimat, mevcut 6. maddeye ek bir madde olarak (7. madde) veya 6. madde ikiye bölünerek eklenebilir; önemli olan sıralamanın "final rapor → özet satırı → süreci sonlandır" olmasıdır.
- Prompt Markdown'dır ve konsola tek parça metin olarak gönderilir; örnek satır kod bloğu veya satır içi kod olarak verilebilir, fazladan kaçış karakteri gerektirmez.
- `data/settings.json` içinde kayıtlı bir `planPostPrompt` varsa yerleşik varsayılan kullanılmaz; manuel doğrulama sırasında bu ayarın boş olduğundan emin olun.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `/settings` üzerinde "After planning prompt" alanında (kayıtlı prompt yokken) soluk metinle gösterilen varsayılanın yeni maddeyi içerdiği görülür.
- [ ] `GET /api/projects/{id}/tasks/{taskId}/plan-prompt` yanıtındaki `prompt` alanında özet satırı talimatının, `## Register the plan in AgentHub` bölümünden önce yer aldığı ve task numarası/başlığının prompt içinde bulunduğu doğrulanır.
