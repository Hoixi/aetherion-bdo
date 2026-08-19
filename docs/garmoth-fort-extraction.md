# Garmoth kale haritaları — veri ve koordinat uzayı

Kullanım izni alındı (garmoth yöneticisi, site public olmadığı sürece, kaynak
belirtmek şartıyla). Kaynak notu `/test/kaleler` sayfasının altında duruyor.

Ekran görüntüsü **almıyoruz**. Karolar, ikonlar ve şekiller kaynağından
canlı çekiliyor; aşağıdaki dönüşüm üçünü aynı çerçeveye oturtuyor.

## Kaynak sayfalar

```
https://garmoth.com/guides/post/occupation-balenos-fort-locations
https://garmoth.com/guides/post/occupation-serendia-fort-locations
```

`curl` **403 dönüyor** — Cloudflare engelliyor. Tarayıcı üzerinden çekmek
gerekiyor (`mcp__Claude_Browser__navigate` + `javascript_tool`).

Her sayfada 7 gömülü harita var: ilki bölge geneli, kalan 6'sı kale başına.

```html
<script type="application/json" class="map-embed-data">{ ... }</script>
```

## Şema

```jsonc
{
  "v": 1,
  "view": { "cx": 224, "cy": 224, "zoom": 3 },   // varsayılan; gerçek görünüm
  "height": 300,                                  // şekillere oturtuluyor
  "calibration": {
    "scaleX": 0.39, "scaleY": 0.39,
    "originX": 82.26, "originY": 94.38,
    "pivotX": 224, "pivotY": 224,
    "yFlip": -1
  },
  "shapes": [
    { "type": "circle",    "coords": [283.6, 195.8], "radius": 1.98,
      "style": { "color": "#48bb78", "weight": 3, "fill": "#48bb78" } },
    { "type": "rectangle", "coords": [[282.9, 204.2], [288.1, 200.1]],
      "style": { "color": "#f56565" } },
    { "type": "image",     "coords": [284.3, 203.6],
      "props": { "iconId": "notretreatingflag" } },
    { "type": "text",      "coords": [284.3, 203.2],
      "props": { "text": "[1] MADPOT", "color": "#f56565", "size": 14 } }
  ]
}
```

`calibration` 14 haritanın hepsinde birebir aynı — tek bir sabit dönüşüm
yetiyor, harita başına ayrı kalibrasyon tutmaya gerek yok.

## Koordinat dönüşümü

**Bu belgenin asıl konusu bu.** İlk denemede dünya genişliği 448 birim
varsayılmıştı; tahmindi ve yanlıştı, noktalar denize düşüyordu. Doğrusu
kaynağın kendi DOM'undan ölçüldü.

### Ölçüm

Balenos sayfasının 2. gömülü haritasında, `scale(1)` ve panel kayması 0 olan
temiz bir durumda:

| Ne | Değer |
|---|---|
| Karo | `5/16/16`, konteynerde `translate3d(-39px, -6px)`, 200×200 |
| İşaretçi | `translate3d(145px, 68px)` |
| Aynı işaretçinin `coords` değeri | `[284.26082, 203.64022]` |

Karo x=16'nın dünya pikseli `16 × 200 = 3200`, ekranda −39'da; yani
`dünya = ekran + 3239`. İşaretçi ekranda (145, 68) → dünyada (3384, 3274).

### Sonuç

```
dünya_pikseli(z) = 2^z × ( origin + scale × flip × (koordinat − pivot) )
```

Doğrulama:

```
x: 82.26 + 0.39 × (284.26082 − 224) = 105.7602   × 32 = 3384.3   (ölçülen 3384)
y: 94.38 + 0.39 × (224 − 203.64022) = 102.3204   × 32 = 3274.3   (ölçülen 3274)
```

Yani izdüşüm değeri **P**, 200 birimlik bir kareyi kaplıyor; zoom z'de
`2^z × 2^z` karo, her biri 200 piksel.

`pivot` çıkarmayı atlarsan tutmaz — ilk denemede kaçan parça buydu.

### Leaflet kurulumu

`CRS.Simple` y'yi ters çeviriyor; izdüşüm zaten ekran yönünde olduğu için
düz dönüşüm kullanılıyor ve P doğrudan latlng oluyor:

```ts
const crs = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, 1, 0),
});
// lat = Py, lng = Px, tileSize = 200
```

Uygulamada canlı sayfa üstünde tekrar ölçüldü — üç etikette de sapma
1 pikselin altında (tamsayıya yuvarlanmış `translate3d` değerlerinden).

## Varlıklar

```
https://assets.garmoth.com/world-map/v2/tiles/{z}/{x}/{y}.webp   zoom 0–7
https://assets.garmoth.com/icons/map-icons/nodeicon_<iconId>.webp
```

Karolar 256px geliyor ama Leaflet 200px'e ölçekliyor (`tileSize: 200`).
Deniz karoları 404 dönüyor; `errorTileUrl` ile saydam geçiliyor.

İkon adlandırmasında **tek istisna** var: `nodewarfort` →
`nodewar_fort.png` (hem ad hem uzantı farklı). Diğerleri kalıba uyuyor.

## Kurulan yapı

| Dosya | İşi |
|---|---|
| `src/data/forts/balenos.json`, `serendia.json` | Çıkarılmış şekiller, 7'şer harita |
| `src/lib/garmoth-forts.ts` | Dönüşüm, katalog, Türkçe etiketler, odak kutusu |
| `src/components/fort-map.tsx` | Leaflet haritası — karolar + şekiller + çizim |
| `src/app/test/kaleler/page.tsx` | Kale seçimi, araç çubuğu, efsane |

Çizimlerimiz garmoth'un şekil şemasını kullanıyor, böylece tek bir çizim
yolu ikisine birden yetiyor.

### Odak kutusu

Kale haritalarında Velia/Olvia gibi uzak referans daireleri de var; hepsini
kapsayacak şekilde oturtunca kale ekranın köşesinde noktacık kalıyor.
Kaynakta kale bölgesi zaten bir dikdörtgenle işaretli, `focusBounds()` varsa
ona odaklanıyor. Bölge haritalarında dikdörtgen ya yok (Balenos) ya da
bölgenin tamamını çevreliyor (Serendia) — ikisi de doğru sonuç veriyor.

## Kalanlar

- Çizimler şu an yalnızca `localStorage`'da. Sunucuya taşımak için savaşa
  bağlı bir `WarPlan` tablosu (`warId`, `fortKey`, `shapes` JSON) uygun.
- Kaynaktaki yazım hataları (`OLIVA`/`OLVIA`, `WESTERN GUARDN CAMP`,
  `POTENCIAL`/`POTENICAL`/`POTENICIAL`) çeviri katmanında düzeltiliyor;
  ham JSON'a dokunulmadı ki kaynakla karşılaştırılabilir kalsın.
