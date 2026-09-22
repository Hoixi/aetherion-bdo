"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  TILE_URL, TILE_SIZE, MIN_ZOOM, MAX_ZOOM, MAX_TILE_ZOOM, WORLD,
  toProj, toCoord, toProjRadius, iconUrl, trLabel, iconLabel, focusBounds, fortIdAt,
  type Shape, type FortMarker, type NodeWarNode, TIER_COLORS,
} from "@/lib/garmoth-forts";

/**
 * Kale haritası — garmoth karolarının üstünde garmoth şekilleri.
 *
 * Ekran görüntüsü almıyoruz: karolar z/x/y olarak doğrudan çiziliyor,
 * şekiller de kendi koordinatlarıyla üstüne biniyor. Dönüşümün nasıl
 * çıkarıldığı `lib/garmoth-forts.ts` başında yazıyor.
 */

export type DrawTool = "pan" | "c" | "l" | "t" | "r";

type Props = {
  /** Garmoth'tan gelen şekiller */
  shapes: Shape[];
  /** Bizim çizdiklerimiz */
  drawn: Shape[];
  /** Devam eden çizim — henüz kaydedilmemiş */
  draft: Shape[];
  showSource: boolean;
  showLabels: boolean;
  tool: DrawTool;
  /** Haritaya tıklandığında garmoth koordinatı döner */
  onPick?: (cx: number, cy: number) => void;
  /** Değişince harita yeniden şekillere oturur */
  fitKey: string;
  /** Bölge haritasında bir kale ikonuna tıklanınca kalenin kimliği döner */
  onFortClick?: (fortId: string) => void;
  /** Her zaman duran kale işaretleri (hangi kale nerede) */
  markers?: FortMarker[];
  /** Seçili kale — işareti vurgulanır */
  activeFort?: string | null;
  /** Planı olan kaleler — işaretinde ✓ */
  planned?: Set<string>;
  /** İşarete tıklanınca (onFortClick yerine doğrudan seçim) */
  onMarkerClick?: (fortId: string) => void;
  /** Diğer node war düğümleri (T2/T3… kaleler ve mevziler) */
  nodes?: NodeWarNode[];
  className?: string;
};

export default function FortMap({
  shapes, drawn, draft, showSource, showLabels, tool, onPick, fitKey,
  onFortClick, markers, activeFort, planned, onMarkerClick, nodes, className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const srcRef = useRef<LayerGroup | null>(null);
  const ownRef = useRef<LayerGroup | null>(null);
  const markRef = useRef<LayerGroup | null>(null);
  const nodeRef = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  // Harita async kuruluyor; çizim efektleri kurulum bitmeden çalışırsa
  // boş dönerdi, bu sayaç bittikten sonra onları bir kez daha tetikliyor
  const [ready, setReady] = useState(0);
  // Olay işleyicileri ref üzerinden okunuyor ki harita bir kez kurulsun
  const pickRef = useRef(onPick);
  const toolRef = useRef(tool);
  const fortRef = useRef(onFortClick);
  const markerRef = useRef(onMarkerClick);
  pickRef.current = onPick;
  toolRef.current = tool;
  fortRef.current = onFortClick;
  markerRef.current = onMarkerClick;

  // ── Kurulum
  useEffect(() => {
    let dead = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !boxRef.current || mapRef.current) return;
      LRef.current = L;

      // CRS.Simple'ın kendi dönüşümü y'yi ters çeviriyor; izdüşümümüz
      // zaten ekran yönünde olduğu için düz (1,0,1,0) kullanıyoruz.
      const crs = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
      });

      const map = L.map(boxRef.current, {
        crs,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 140,
        attributionControl: false,
        zoomControl: true,
      });
      map.setView([WORLD / 2, WORLD / 2], 4);
      map.setMaxBounds([[-40, -40], [WORLD + 40, WORLD + 40]]);

      L.tileLayer(TILE_URL, {
        tileSize: TILE_SIZE,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // Karo piramidi 7'de bitiyor; ötesinde son karo büyütülerek
        // gösteriliyor, şekiller vektör olduğu için net kalıyor
        maxNativeZoom: MAX_TILE_ZOOM,
        noWrap: true,
        // Deniz karoları 404 dönüyor; boş bırakmak yerine sessizce geçiyoruz
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      }).addTo(map);

      srcRef.current = L.layerGroup().addTo(map);
      ownRef.current = L.layerGroup().addTo(map);
      nodeRef.current = L.layerGroup().addTo(map);
      markRef.current = L.layerGroup().addTo(map);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (toolRef.current === "pan") return;
        const [cx, cy] = toCoord(e.latlng.lat, e.latlng.lng);
        pickRef.current?.(cx, cy);
      });

      mapRef.current = map;

      // Kart açılırken 0 yükseklikte kurulursa Leaflet ölçüyü kaçırıyor
      roRef.current = new ResizeObserver(() => map.invalidateSize());
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

  // ── Katmanları çiz
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !srcRef.current || !ownRef.current) return;

    srcRef.current.clearLayers();
    ownRef.current.clearLayers();

    if (showSource) {
      paint(L, srcRef.current, shapes, showLabels, true, (x, y) => {
        const id = fortIdAt(shapes, x, y);
        if (id) fortRef.current?.(id);
      });
    }
    paint(L, ownRef.current, [...drawn, ...draft], true, false);
  }, [shapes, drawn, draft, showSource, showLabels, ready]);

  // ── Kale işaretleri (her zaman görünür)
  useEffect(() => {
    const L = LRef.current;
    if (!L || !markRef.current) return;
    markRef.current.clearLayers();
    for (const m of markers ?? []) {
      const secili = m.id === activeFort;
      const plan = planned?.has(m.id);
      const html = `<span class="fort-pin${secili ? " on" : ""}">`
        + `<img src="${iconUrl("nodewarfort")}" alt="" />`
        + `<b>${escapeHtml(m.name)}${plan ? " ✓" : ""}</b></span>`;
      L.marker(toProj(m.x, m.y), {
        icon: L.divIcon({ className: "fort-pin-kutu", html, iconSize: [120, 46], iconAnchor: [60, 46] }),
        title: m.name,
        keyboard: false,
      }).addTo(markRef.current)
        .on("click", (e) => { L.DomEvent.stopPropagation(e); markerRef.current?.(m.id); });
    }
  }, [markers, activeFort, planned, ready]);

  // ── Diğer node war düğümleri (küçük rozetler)
  useEffect(() => {
    const L = LRef.current;
    if (!L || !nodeRef.current) return;
    nodeRef.current.clearLayers();
    for (const n of nodes ?? []) {
      const renk = TIER_COLORS[n.tier] ?? "#9a9aa2";
      const html = `<span class="nw-pin${n.castle ? " kale" : ""}" style="--nw:${renk}">`
        + `<i>${n.castle ? "♜" : n.tier || "?"}</i><b>${escapeHtml(n.name)}</b></span>`;
      L.marker(toProj(n.x, n.y), {
        icon: L.divIcon({ className: "nw-pin-kutu", html, iconSize: [10, 10], iconAnchor: [5, 5] }),
        title: `${n.name} · T${n.tier}${n.castle ? " · kale kuşatması" : ""} · ${n.region}`,
        keyboard: false,
        interactive: true,
      }).addTo(nodeRef.current);
    }
  }, [nodes, ready]);

  // ── Kale değişince oraya odaklan
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = focusBounds(shapes);
    if (!b) return;
    // Koordinat uzayında y aşağı doğru azalıyor; izdüşüme çevirince
    // köşeler yer değiştiriyor, latLngBounds ikisini de kabul ediyor.
    map.fitBounds([toProj(b.x0, b.y0), toProj(b.x1, b.y1)], {
      padding: [40, 40],
      maxZoom: MAX_ZOOM,
      animate: false,
    });
  }, [fitKey, shapes, ready]);

  // ── İmleç
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.style.cursor = tool === "pan" ? "" : "crosshair";
  }, [tool]);

  return <div ref={boxRef} className={className} />;
}

/** Şekilleri bir katman grubuna basar */
function paint(
  L: typeof import("leaflet"),
  group: LayerGroup,
  shapes: Shape[],
  withLabels: boolean,
  fromSource: boolean,
  /** Kale ikonuna tıklandığında koordinatını verir */
  onFort?: (x: number, y: number) => void,
) {
  for (const s of shapes) {
    if (s.t === "c") {
      L.circle(toProj(s.p[0], s.p[1]), {
        radius: toProjRadius(s.r),
        color: s.k,
        weight: 2,
        fillColor: s.k,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(group);
      continue;
    }

    if (s.t === "r") {
      L.rectangle([toProj(s.p[0], s.p[1]), toProj(s.p[2], s.p[3])], {
        color: s.k,
        weight: 2,
        fill: false,
        dashArray: fromSource ? undefined : "5,5",
        interactive: false,
      }).addTo(group);
      continue;
    }

    if (s.t === "l") {
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < s.p.length; i += 2) pts.push(toProj(s.p[i], s.p[i + 1]));
      if (pts.length < 2) continue;
      L.polyline(pts, { color: s.k, weight: 3, interactive: false }).addTo(group);
      continue;
    }

    if (s.t === "i") {
      const isFort = s.i === "nodewarfort" && Boolean(onFort);
      const label = isFort ? iconLabel(s.i) + " — detay için tıkla" : iconLabel(s.i);
      const marker = L.marker(toProj(s.p[0], s.p[1]), {
        icon: L.icon({
          iconUrl: iconUrl(s.i),
          // Tıklanabilir kale ikonu biraz daha büyük dursun
          iconSize: isFort ? [52, 52] : [40, 40],
          // Çapa alt-orta: ikon oyundaki nesnenin üstünde duruyor
          iconAnchor: isFort ? [26, 52] : [20, 40],
        }),
        title: label,
        alt: label,
        interactive: true,
        keyboard: false,
      })
        .bindTooltip(label, { direction: "top", offset: [0, isFort ? -50 : -38] })
        .addTo(group);

      if (isFort) {
        marker.on("click", (e) => {
          // Harita tıklaması da tetiklenip çizim eklemesin
          L.DomEvent.stopPropagation(e);
          onFort!(s.p[0], s.p[1]);
        });
        marker.getElement()?.style.setProperty("cursor", "pointer");
      }
      continue;
    }

    if (s.t === "t") {
      if (!withLabels) continue;
      const text = trLabel(s.x);
      const size = s.z ?? 14;
      L.marker(toProj(s.p[0], s.p[1]), {
        icon: L.divIcon({
          className: "fort-label",
          html: `<span style="color:${s.k};font-size:${size}px">${escapeHtml(text)}</span>`,
          iconSize: [160, 20],
          iconAnchor: [80, 10],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(group);
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}
