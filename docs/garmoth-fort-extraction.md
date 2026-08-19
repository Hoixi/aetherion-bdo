# Garmoth kale konumları — çıkarma tarifi

Kullanım izni alındı (garmoth yöneticisi, site public olmadığı sürece, kaynak
belirtmek şartıyla). Kaynak notu sayfada görünür yerde durmalı.

## Kaynak sayfalar

```
https://garmoth.com/guides/post/occupation-balenos-fort-locations
https://garmoth.com/guides/post/occupation-serendia-fort-locations
```

`curl` **403 dönüyor** — Cloudflare engelliyor. Tarayıcı üzerinden çekmek gerekiyor
(`mcp__Claude_Browser__navigate` + `javascript_tool`).

## Veri nerede

Sayfada her gömülü harita için bir tane:

```html
<script type="application/json" class="map-embed-data">{ ... }</script>
```

Balenos'ta 7 tane var: ilki bölge geneli, kalan 6'sı kale başına.

## Şema

```jsonc
{
  "v": 1,
  "view": { "cx": 224, "cy": 224, "zoom": 3 },
  "height": 300,
  "calibration": {
    "scaleX": 0.39, "scaleY": 0.39,
    "originX": 82.26, "originY": 94.38,
    "pivotX": 224, "pivotY": 224,
    "yFlip": -1
  },
  "shapes": [
    { "type": "circle", "coords": [283.6, 195.8], "radius": 1.98,
      "style": { "color": "#48bb78", "weight": 3, "fill": "#48bb78" } },
    { "type": "text", "coords": [271.7, 190.1],
      "props": { "text": "WESTERN GUARD CAMP", "color": "#48bb78", "size": 14 } },
    { "type": "image", "coords": [...], "props": { "alt": "No-Retreat Flag" } }
  ]
}
```

Şekil türleri: `circle`, `text`, `image` (ayrıca polyline/polygon olabilir —
çıkarırken `type` alanını sabit varsayma).

## Etiket düzeni

Kale haritalarındaki metinler kurulum noktalarını numaralandırıyor:

```
[1] MADPOT
[2]  [3]  [4]
[5] POTENCIAL SPOT ... [8] POTENCIAL SPOT
```

Bölge haritasında ise kale adları geçiyor: CRON CASTLE, FOREST OF PLUNDER,
BARTALI FARM, WESTERN GUARD CAMP, ALTAR OF AGRIS, WOLF HILL. Ayrıca VELIA,
OLVIA gibi şehir etiketleri de var — kale değiller, ayıklanmalı.

Not: kaynakta yazım tutarsızlıkları var (`OLIVA`/`OLVIA`,
`WESTERN GUARDN CAMP`, `POTENCIAL`). Türkçeleştirirken düzeltilebilir.

## Karo piramidi

Garmoth kendi dünya haritasını servis ediyor, 256px karolar:

```
https://assets.garmoth.com/world-map/v2/tiles/{z}/{x}/{y}.webp
```

Kale koordinatları bu haritanın uzayında. Bizim `/harita` questlog karoları
kullanıyor (336px) — iki uzay farklı, `calibration` bloğu dönüşümü veriyor.

## Çıkarma betiği (tarayıcı konsolunda çalışır)

```js
(() => {
  const E = [...document.querySelectorAll('.map-embed-data')];
  const R = n => Math.round(n * 10) / 10;
  return JSON.stringify(E.map(e => {
    const j = JSON.parse(e.textContent);
    return {
      c: j.calibration,
      s: (j.shapes || []).map(s => {
        const o = { t: s.type[0], p: (s.coords || []).map(R) };
        if (s.type === 'text')  o.x = s.props?.text;
        if (s.type === 'image') o.x = s.props?.alt || '';
        if (s.radius) o.r = R(s.radius);
        return o;
      }),
    };
  }));
})();
```

Balenos çıktısı ~13KB, Serendia benzer. Bağlamı şişirmemek için doğrudan
dosyaya yazdırmak, ajanın içinden geçirmemek gerekiyor.

## Sayfa planı

`/test/kaleler`

1. Bölge seç (Balenos / Serendia)
2. Kale seç — bölge haritası, kaleler işaretli
3. Kurulum noktası seç — kale haritası, numaralı noktalar
4. Çizim katmanı

Çizim için ayrı bir format icat etmeye gerek yok: garmoth'un `shapes` dizisi
zaten circle/text/image/polyline taşıyor. Aynı şemayı kullanırsak kendi
çizimlerimiz garmoth verisiyle aynı yapıda olur, tek render yolu yeter.

Kaydetmek için `MapPoint`'e benzer bir tablo ya da savaşa bağlı bir
`WarPlan` tablosu (warId, fortKey, shapes JSON) uygun olur.
