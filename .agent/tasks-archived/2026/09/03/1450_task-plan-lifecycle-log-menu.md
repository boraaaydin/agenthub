# Görev ve plan yaşam döngüsü günlük menüsü

## Description

Görev ve plan kayıtlarının yaşam döngüsü durumlarındaki değişiklikleri kalıcı ve görüntülenebilir bir günlükte tut. Ana gezinmeye bir `Logs` menü öğesi ekleyerek kullanıcıların bu geçmişe ayrı bir ekrandan ulaşmasını sağla.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

Görev durumları `open`, `plan_creating`, `plan_created`, `in_progress`, `completed` ve `cancelled`; plan durumları ise `registered`, `executing`, `executed`, `completed` ve `cancelled` olarak tanımlıdır. Bu durumlar kullanıcı tarafından ayrıntı ekranlarından değiştirilebildiği gibi plan oluşturma, planlama oturumunun kapanması ve plan yürütme/bitirme akışları tarafından da değiştirilmektedir.

Mevcut görev ve plan kayıtları git tarafından yok sayılan `data/tasks.json` ve `data/plans.json` dosyalarında saklanır. Günlük yalnızca bu çalışmadan sonra gerçekleşen yaşam döngüsü olaylarını kapsar; geçmiş kayıtlar için geriye dönük olay üretimi yapılmaz. Başlık, açıklama, dosya yolu, proje/görev ilişkilendirmesi veya silme gibi durum dışı düzenlemeler günlük olayı oluşturmaz.

## Acceptance Criteria

- [ ] Görev veya plan oluşturulduğunda, başlangıç durumunu içeren bir yaşam döngüsü olayı kalıcı günlüğe eklenir.
- [ ] Bir görevin ya da planın durumu gerçekten değiştiğinde, önceki durum, yeni durum, olay zamanı, kayıt türü, kayıt kimliği ve proje kimliği günlüğe yazılır; aynı duruma yapılan güncellemeler yeni olay oluşturmaz.
- [ ] Günlük kaydı, API, konsol ve otomatik akışlar dahil mevcut tüm durum değiştirme yollarından üretilir; özellikle plan kaydının görevi `plan_created` durumuna taşıması, planlama kapanışındaki görevin yeniden açılması ve plan yürütme/tamamlama geçişleri kaydedilir.
- [ ] Günlük verisi, uygulama yeniden başlatıldıktan sonra da git tarafından yok sayılan ayrı bir veri dosyasından okunabilir; bozuk ya da okunamayan günlük verisi kullanıcıya güvenli bir hata durumu gösterir.
- [ ] Ana gezinmede `Logs` adlı erişilebilir bir menü öğesi bulunur; `/logs` rotasında aktif durum doğru biçimde belirtilir.
- [ ] `/logs` ekranı olayları en yeniden eskiye sıralı olarak; zaman, proje, kayıt türü ve kimliği, önceki durum ile yeni durum bilgileriyle gösterir. Kayıt mevcutsa görev veya plan ayrıntısına bağlantı verir; silinmiş kayıtlar için bozuk bağlantı üretmez.
- [ ] Günlük boşken ve veri yüklenemediğinde anlaşılır, erişilebilir boş/hata durumları gösterilir.

## Technical Notes

- Uygulamanın başka kayıt biçimlerinden bağımsız, sunucu tarafı bir günlük deposu ve doğrulanmış bir olay şeması oluştur; olay kimliği, `entityType` (`task` veya `plan`), `entityId`, `projectId`, `fromStatus` (`null` başlangıç olayı için), `toStatus` ve `createdAt` alanlarını sakla.
- Durum karşılaştırması ve olay eklemeyi `src/lib/tasks-store.ts` ile `src/lib/plans-store.ts` içindeki yazma akışlarına yerleştir; böylece `PATCH` çağrılarını yapan istemci bileşenleri ile sunucu akışlarının ayrı ayrı günlükleme yapmasına gerek kalmaz ve olay atlanmaz.
- Eşzamanlı yazmaları mevcut store kuyruklama yaklaşımıyla güvenli tut; görev/plan güncellemesi ile günlük olayı arasında hata oluştuğunda başarıyla gerçekleşmiş bir durum değişikliğinin sessizce kayıtsız kalmamasını sağlayacak hata davranışını tanımla ve uygula.
- Günlük ekranında proje adını ve renkli proje çipini `projects-store` verisinden çöz; kayıt mevcutsa `task` ve `plan` ayrıntı rotalarına mevcut bağlantı yardımcılarını kullan.
- Liste için mevcut sayfa görsel dili, tarih biçimleme, semantik tablo/liste ve erişilebilir odak stillerini koru. Gerekli olduğunda olay sayısı büyüdüğünde kullanılabilir kalacak sayfalama yaklaşımını ekle.
- Uygulama davranışı ve yeni kalıcı `data` dosyasını `.agent/PROJECT_DOCUMENT.md` içinde güncelle.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Görev ve plan oluşturma ile manuel, otomatik planlama ve yürütme/tamamlama durum geçişlerinin her biri için doğru önceki/yeni durum ve zamanla günlük olayı oluşturulduğunu doğrula.
- [ ] Aynı duruma yapılan güncellemenin yeni günlük kaydı oluşturmadığını, uygulama yeniden başlatıldıktan sonra günlük kayıtlarının korunduğunu ve `Logs` menüsü ile `/logs` ekranındaki bağlantılar, boş durum ve hata durumunun çalıştığını manuel olarak doğrula.
