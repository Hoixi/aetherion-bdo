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

---

## Çözüm: DOM'dan doğrudan al, koordinat dönüşümü yapma

`calibration` bloğundan güvenilir bir dönüşüm çıkarmaya çalışmak gereksizdi.
Leaflet zaten her şeyi ekrana yerleştirmiş durumda ve konumlar DOM'da yazıyor.

### Karolar

```
.leaflet-tile-container   → transform: translate3d(0,0,0) scale(S)
img.leaflet-tile          → src + transform: translate3d(Xpx, Ypx, 0) + width/height
```

Karonun ekrandaki yeri `(X * S, Y * S)`, boyutu `width * S`. Örnekte
`S = 0.707107`, karo 200px → ekranda 141.4px.

### İşaretçiler

```
.leaflet-marker-icon      → transform: translate3d(Xpx, Ypx, 0)
                            margin-left / margin-top  (çapa kayması)
```

`translate3d` değeri doğrudan çapa noktası; margin'ler kutuyu ortalamak
için, konumu değiştirmiyor. Marker pane karo konteynerindeki `scale`'i
almıyor, yani bu değerler zaten ekran uzayında.

Alt türler:
- `.bdo-draw-image` → içinde `img` (ikon), `alt` etiketi taşıyor
- `.bdo-draw-text`  → içinde `span.bdo-draw-text__label`, rengi inline style'da
- `.bdo-town-marker` → şehir etiketi (Velia, Heidel…), istenirse elenir

### Harita paneli kayması

`.leaflet-map-pane` üzerinde `transform: translate3d(-78px, 0, 0)` gibi bir
kayma olabiliyor; hem karolara hem işaretçilere uygulanır.

### Doğrulama

Örnek veride iki metin işaretçisi:

```
GLISH   coords [278.54, 164.44] → translate3d(315px, 230px)
HEIDEL  coords [289.76, 177.94] → translate3d(414px, 111px)
```

Aradaki afin: `px = 8.82 * coord + sabit`, y ekseni ters. Tutarlı çıkıyor,
ama üretimde kullanmaya gerek yok — piksel değerleri zaten elimizde.

### Çıkarma betiği

```js
(() => {
  const box = document.querySelector('.bdo-map-embed__map');
  const pane = box.querySelector('.leaflet-map-pane');
  const cont = box.querySelector('.leaflet-tile-container');
  const num = (el, re) => { const m = (el.getAttribute('style')||'').match(re); return m ? parseFloat(m[1]) : 0; };
  const tx = (el) => {
    const m = (el.getAttribute('style')||'').match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  };
  const S = num(cont, /scale\(([-\d.]+)\)/) || 1;
  const [px, py] = tx(pane);
  return JSON.stringify({
    w: box.clientWidth, h: box.clientHeight, pane: [px, py], scale: S,
    tiles: [...cont.querySelectorAll('img.leaflet-tile')].map(t => {
      const [x, y] = tx(t);
      return { src: t.src, x, y, w: parseFloat(t.style.width) };
    }),
    marks: [...box.querySelectorAll('.leaflet-marker-pane > div')].map(m => {
      const [x, y] = tx(m);
      const img = m.querySelector('img');
      const lab = m.querySelector('.bdo-draw-text__label');
      return {
        x, y,
        icon: img && !m.classList.contains('bdo-town-marker') ? img.src : null,
        text: lab ? lab.textContent : null,
        color: lab ? lab.style.color : null,
        town: m.classList.contains('bdo-town-marker') || null,
      };
    }),
  });
})();
```

### Birleştirme

Bu çıktı `sharp` ile sunucuda birleştirilir:

1. `w × h` boyutunda tuval
2. Her karo: `assets.garmoth.com`'dan indir, `w*S` boyutuna getir,
   `(x*S + paneX, y*S + paneY)` konumuna yapıştır
3. İkonlar: indir, `(x + paneX - 24, y + paneY - 48)` konumuna yapıştır
   (48×48 ikonun çapası alt-orta)
4. Metinler: SVG katmanı olarak üstüne bindir
5. `webp` olarak `public/map/forts/<id>.webp`

Veri ajanın bağlamından geçmesin diye, çıktıyı bir API ucuna yapıştırıp
işlemi sunucuda yaptırmak en pratiği.
