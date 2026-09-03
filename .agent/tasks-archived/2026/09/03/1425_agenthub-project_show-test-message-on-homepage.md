# Ana sayfada deneme mesajı göster

## Description

Ana sayfada kullanıcıya görünen basit bir deneme mesajı ekle: `Deneme mesajı`.

## Application

Root application (`agenthub-project`)

## Dependencies

None - This task is independent

## Context

Ana sayfa `src/app/page.tsx` dosyasında tanımlıdır. Mevcut başlık, açıklama ve gezinme bağlantılarını koruyarak bu sayfanın ana içerik alanında deneme mesajını görünür kıl.

## Acceptance Criteria

- [ ] `/` ana sayfası `Deneme mesajı` metnini kullanıcıya görünür olarak gösterir.
- [ ] Mevcut ana sayfa başlığı, açıklaması ve gezinme bağlantıları çalışmaya ve görünmeye devam eder.
- [ ] Yeni mesaj, mevcut sayfa görsel düzeni ve Tailwind stilleriyle tutarlı biçimde sunulur.

## Technical Notes

- Uygulamaya başlamadan önce `.agent/PROJECT_DOCUMENT.md` dosyasını oku.
- Değişikliği `src/app/page.tsx` ile sınırlı tut; bu deneme mesajı için yeni bağımlılık, API veya kalıcı veri ekleme.
- Next.js kodu yazmadan önce ilgili güncel Next.js rehberini `node_modules/next/dist/docs/` altında incele.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Tarayıcıda `/` sayfasını açıp `Deneme mesajı` metninin görünür olduğunu ve mevcut gezinme bağlantılarının bulunduğunu doğrula.
