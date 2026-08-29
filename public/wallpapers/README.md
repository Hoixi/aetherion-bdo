# Karşılama ekranı duvar kâğıtları

Buraya koyduğun görseller giriş ekranının arkasında **bulanık ve
karartılmış** olarak dönüyor. Sayfa her açıldığında içlerinden biri
rastgele seçiliyor.

## Nasıl eklenir

Görseli bu klasöre kopyala, kod değişikliği gerekmiyor —
`/api/wallpapers` klasörü çalışma anında okuyor.

Kabul edilen uzantılar: `.webp`, `.jpg`, `.jpeg`, `.png`, `.avif`

## Öneriler

- **En az 1920×1080.** Arka plan bulanıklaştığı için çok keskin olması
  gerekmiyor ama küçük görsel büyütülünce bloklaşıyor.
- **Karanlık ya da orta tonlu kareler** en iyi duruyor: üstüne koyu bir
  perde ve altın renkli yazı biniyor.
- **Dosya boyutunu tut.** Görseller derlemeye giriyor ve ziyaretçiye
  indiriliyor; tane başına ~300 KB altını hedefle. `.webp` en iyisi.
- Çok kalabalık/parlak kareler yazıyı okunmaz yapıyor; ufuk çizgisi
  veya manzara türü kareler daha iyi sonuç veriyor.

Klasör boşsa ekran eskisi gibi düz zeminle açılıyor — kırılmıyor.
