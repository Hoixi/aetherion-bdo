"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  KARO_PX, KARO_URL, MIN_ZOOM, MAX_ZOOM, MAX_KARO_ZOOM, TIER_RENK, IKON, karoSatiri,
  dunyaToProj, projToDunya, projYaricap, sinirlar, type HaritaNode,
} from "@/lib/bdo-harita";
import type { SavasOlayi } from "@/lib/savas-olaylari";
import { addCombatHeat } from "@/lib/combat-heat-layer";

/**
 * Dünya haritası — oyundan çıkarılmış karolar.
 *
 * Katmanlar: düğümler (mevziler + şehirler), savaş olayları (kill/ölüm) ve
 * seçili düğümün alan dairesi. Düğüm ve olay konumları ham oyun
 * koordinatı; dönüşüm `bdo-harita.ts` içinde tek bölme.
 *
 * Etiketler yakınlığa göre açılıyor: uzaktan şehirler ve o hafta savaş
 * açık olan mevziler okunuyor, yaklaşınca diğer adlar da geliyor — yoksa
 * 176 etiket üst üste binip haritayı okunmaz yapıyor.
 */

type Props = {
  nodlar: HaritaNode[];
  olaylar?: SavasOlayi[];
  seciliKey?: number | null;
  onNode?: (n: HaritaNode) => void;
  onOlay?: (at: number) => void;
  seciliOlay?: number | null;
  /** Olay yoğunluğu katmanı — ekran pikseli ölçeğinde, alan hâkimiyeti değil */
  isi?: boolean;
  /** Değişince harita buraya gider — oyun koordinatı ve yakınlık */
  odak?: { x: number; z: number; zoom: number } | null;
  odakKey?: string;
  /** Karolar yüklenemiyorsa (sunucu kapalı, yanlış adres) bir kez haber verir */
  onKaroHata?: () => void;
  className?: string;
};

const KILL = "#5fd39a";
const DEATH = "#ef5f5f";

export default function DunyaHaritasi({
  nodlar, olaylar = [], seciliKey, onNode, onOlay, seciliOlay, isi = false,
  odak, odakKey, onKaroHata, className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const nodeRef = useRef<LayerGroup | null>(null);
  const olayRef = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(0);
  const [zoom, setZoom] = useState(3);
  const nodeCb = useRef(onNode); nodeCb.current = onNode;
  const hataCb = useRef(onKaroHata); hataCb.current = onKaroHata;
  const olayCb = useRef(onOlay); olayCb.current = onOlay;

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !boxRef.current || mapRef.current) return;
      LRef.current = L;

      // İzdüşüm zaten ekran yönünde (lat aşağı artar); CRS.Simple'ın kendi
      // y çevirmesi kapatılıyor
      const crs = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
      });
      const map = L.map(boxRef.current, {
        crs, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 140,
        attributionControl: false, zoomControl: false,
        // Dünyanın dışına sürüklenemesin
        maxBounds: sinirlar(), maxBoundsViscosity: 1,
      });
      map.fitBounds(sinirlar());

      /**
       * Alt yakınlık sınırı pencereye göre: dünya ekrandan küçük kalırsa
       * harita köşede yüzen bir kareye dönüşüyordu. Pencere boyu değişince
       * yeniden hesaplanıyor.
       */
      const sinirAyarla = () => {
        const el = boxRef.current;
        if (!el || !el.clientWidth || !el.clientHeight) return;
        const [[y0, x0], [y1, x1]] = sinirlar();
        const gerekli = Math.log2(Math.max(el.clientWidth / (x1 - x0), el.clientHeight / (y1 - y0)));
        const min = Math.min(MAX_KARO_ZOOM, Math.max(MIN_ZOOM, Math.ceil(gerekli * 4) / 4));
        map.setMinZoom(min);
        if (map.getZoom() < min) map.setZoom(min, { animate: false });
        map.panInsideBounds(L.latLngBounds(sinirlar()), { animate: false });
      };
      sinirAyarla();

      let yuklendi = false, hata = 0;
      // Piramit satırları yukarı sayıyor; Leaflet'in istediği satır çevriliyor
      const Karolar = L.TileLayer.extend({
        getTileUrl(this: { _url: string; _getZoomForUrl: () => number },
                   c: { x: number; y: number }) {
          return L.Util.template(this._url,
            { z: this._getZoomForUrl(), x: c.x, y: karoSatiri(c.y) });
        },
      });
      new (Karolar as unknown as new (u: string, o: object) => import("leaflet").TileLayer)(KARO_URL, {
        tileSize: KARO_PX, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        maxNativeZoom: MAX_KARO_ZOOM, noWrap: true,
        // Deniz karoları yok; boş bırakmak kırık resim gösteriyordu
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      })
        // Izgara dışında kalan deniz karoları da 404 veriyor; sunucunun
        // kapalı olduğunu ancak hiç karo yüklenmediğinde söyleyebiliriz
        .on("tileload", () => { yuklendi = true; })
        .on("tileerror", () => { if (!yuklendi && ++hata >= 6) hataCb.current?.(); })
        .addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);

      nodeRef.current = L.layerGroup().addTo(map);
      olayRef.current = L.layerGroup().addTo(map);
      map.on("zoomend", () => setZoom(map.getZoom()));
      setZoom(map.getZoom());

      mapRef.current = map;
      roRef.current = new ResizeObserver(() => { map.invalidateSize(); sinirAyarla(); });
      roRef.current.observe(boxRef.current);
      setReady((n) => n + 1);
    })();
    return () => {
      dead = true;
      roRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Düğümler
  useEffect(() => {
    const L = LRef.current, katman = nodeRef.current;
    if (!L || !katman) return;
    katman.clearLayers();

    // Yakınlaştıkça daha çok etiket; aktif mevziler her zaman okunur
    const etiketli = (n: HaritaNode) =>
      n.tur === "sehir" || n.aktif || n.kale || zoom >= 5 || (zoom >= 3.5 && n.tier <= 2);

    for (const n of nodlar) {
      const [lat, lng] = dunyaToProj(n.x, n.z);
      const secili = seciliKey === n.key;
      const sehir = n.tur === "sehir";
      // Kuşatma sahaları kademe renklerinden ayrı dursun
      const renk = sehir ? "#8fd0e8" : n.kale ? "#c86fd8" : TIER_RENK[n.tier] ?? "#e8b451";

      if (secili && n.r > 0) {
        L.circle([lat, lng], {
          radius: projYaricap(n.r), color: renk, weight: 1,
          fillColor: renk, fillOpacity: 0.12, interactive: false,
        }).addTo(katman);
      }

      // Aktif mevziler dışarıdan bir halkayla ayrılıyor
      const boy = n.kale ? 30 : sehir ? 20 : n.aktif ? 26 : 18;
      const ikon = sehir ? IKON.sehir : n.kale ? IKON.kale : IKON.mevzi;
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          // Ölçü CSS ile veriliyor: kaynak SVG'lerin kendi boyu ~100px ve
          // width/height öznitelikleri tek başına onu kısmıyor
          html: `<img src="${ikon}" alt="" style="
                 display:block;width:${boy}px;height:${boy}px;
                 filter:drop-shadow(0 1px 3px #000) drop-shadow(0 0 5px rgba(0,0,0,.8))${secili ? " brightness(1.4)" : ""};
                 opacity:${sehir && !secili ? 0.85 : 1}">`,
          iconSize: [boy, boy], iconAnchor: [boy / 2, boy / 2],
        }),
        // Seçili ve aktif olanlar diğerlerinin üstünde kalsın
        zIndexOffset: secili ? 2000 : n.kale ? 1500 : n.aktif ? 1000 : 0,
      })
        .bindTooltip(sehir ? n.ad
                     : n.kale ? `${n.ad} · kuşatma savaşı${n.aktif ? " · node war da açık" : ""}`
                       : `${n.ad} · T${n.tier}${n.aktif ? " · savaş açık" : ""}`,
                     { direction: "top", opacity: 0.95 })
        .on("click", () => nodeCb.current?.(n))
        .addTo(katman);

      // Mevzinin kalesi ayrı bir yerde duruyor (node merkezi değil)
      if (n.kaleX != null && n.kaleZ != null) {
        const [klat, klng] = dunyaToProj(n.kaleX, n.kaleZ);
        L.marker([klat, klng], {
          icon: L.divIcon({
            className: "",
            html: `<img src="${IKON.kale}" alt="" style="display:block;width:24px;height:24px;
                   filter:drop-shadow(0 1px 3px #000) drop-shadow(0 0 5px rgba(0,0,0,.8))">`,
            iconSize: [24, 24], iconAnchor: [12, 12],
          }),
          zIndexOffset: secili ? 1800 : 900,
        })
          .bindTooltip(`${n.ad} kalesi · mevzi merkezine ${n.kaleUzak ?? "?"} m`,
                       { direction: "top", opacity: 0.95 })
          .on("click", () => nodeCb.current?.(n))
          .addTo(katman);
      }

      if (etiketli(n)) {
        L.marker([lat, lng], {
          interactive: false,
          icon: L.divIcon({
            className: "",
            html: `<div style="white-space:nowrap;font-size:${sehir || n.aktif ? 11 : 10}px;
                   font-weight:${n.aktif || n.kale ? 700 : 600};
                   color:${secili ? "#fff" : renk};text-shadow:0 1px 3px #000,0 0 6px #000;
                   transform:translate(${n.kale ? 19 : n.aktif ? 17 : 12}px,-7px);
                   opacity:${sehir || n.aktif ? 1 : 0.85}">${n.ad}</div>`,
            iconSize: [0, 0],
          }),
        }).addTo(katman);
      }
    }
  }, [nodlar, seciliKey, zoom, ready]);

  // ── Savaş olayları
  useEffect(() => {
    const L = LRef.current, katman = olayRef.current;
    if (!L || !katman) return;
    katman.clearLayers();
    for (const o of olaylar) {
      const [lat, lng] = dunyaToProj(o.dunya[0], o.dunya[2]);
      const secili = seciliOlay != null && o.at === seciliOlay;
      const renk = o.bizimKill ? KILL : DEATH;
      L.circleMarker([lat, lng], {
        radius: secili ? 8 : 5,
        color: secili ? "#fff" : renk, weight: secili ? 2 : 1,
        fillColor: renk, fillOpacity: secili ? 1 : 0.75,
      })
        .bindTooltip(
          `<b>${o.bizimAile}</b> ${o.bizimKill ? "→" : "←"} ${o.rakipAile}` +
          `<br>${o.rakipKlan || "—"} · ${new Date(o.at).toLocaleTimeString("tr-TR")}`,
          { direction: "top", opacity: 0.95 },
        )
        .on("click", () => olayCb.current?.(o.at))
        .addTo(katman);
    }
  }, [olaylar, seciliOlay, ready]);

  // ── Isı katmanı
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isi || olaylar.length === 0) return;
    return addCombatHeat(map, olaylar.map((o) => dunyaToProj(o.dunya[0], o.dunya[2])));
  }, [isi, olaylar, ready]);

  // ── Odak
  // fitBounds küçük kutularda beklenmedik yerlere oturuyordu; merkez + yakınlık
  // hem daha öngörülebilir hem de "mevziye git" için doğru davranış.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !odak) return;
    map.setView(dunyaToProj(odak.x, odak.z), odak.zoom, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odakKey, ready]);

  return <div ref={boxRef} className={className} style={{ background: "#11202a" }} />;
}

/** Fare konumundan oyun koordinatı — geliştirirken kalibrasyon kontrolü için */
export const projeToDunya = projToDunya;
