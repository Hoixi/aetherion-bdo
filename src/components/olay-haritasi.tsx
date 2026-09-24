"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  TILE_URL, TILE_SIZE, MIN_ZOOM, MAX_ZOOM, MAX_TILE_ZOOM, WORLD, toProj,
} from "@/lib/garmoth-forts";
import type { SavasOlayi } from "@/lib/savas-olaylari";

/**
 * Olay haritası — kill/ölüm noktaları garmoth karolarının üstünde.
 *
 * Kale haritasıyla aynı karo ve aynı izdüşüm kullanılıyor; oyun
 * koordinatı `savas-olaylari.ts` içinde garmoth uzayına çevriliyor, yani
 * kurulum planlarıyla aynı harita üzerinde konuşuyoruz.
 *
 * Noktalar daire olarak çiziliyor (ikon değil): yüzlerce olayda DOM'u
 * şişirmiyor ve yakınlaştırınca da aynı kalıyor.
 */

type Props = {
  olaylar: SavasOlayi[];
  /** Seçili olay — vurgulanır ve haritanın merkezine alınır */
  seciliAt?: number | null;
  onSec?: (at: number) => void;
  /** Değişince harita olayların kutusuna yeniden oturur */
  fitKey: string;
  kutu: { x0: number; y0: number; x1: number; y1: number } | null;
  className?: string;
};

const KILL = "#5fd39a";
const DEATH = "#ef5f5f";

export default function OlayHaritasi({ olaylar, seciliAt, onSec, fitKey, kutu, className }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const katmanRef = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(0);
  const secRef = useRef(onSec);
  secRef.current = onSec;

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !boxRef.current || mapRef.current) return;
      LRef.current = L;

      // İzdüşüm zaten ekran yönünde; CRS.Simple'ın y çevirmesi kapatılıyor
      const crs = L.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(1, 0, 1, 0),
      });
      const map = L.map(boxRef.current, {
        crs, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 140,
        attributionControl: false, zoomControl: true,
      });
      map.setView([WORLD / 2, WORLD / 2], 4);
      map.setMaxBounds([[-40, -40], [WORLD + 40, WORLD + 40]]);

      L.tileLayer(TILE_URL, {
        tileSize: TILE_SIZE, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        maxNativeZoom: MAX_TILE_ZOOM, noWrap: true,
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      }).addTo(map);

      katmanRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
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

  // ── Noktalar
  useEffect(() => {
    const L = LRef.current, map = mapRef.current, katman = katmanRef.current;
    if (!L || !map || !katman) return;
    katman.clearLayers();

    for (const o of olaylar) {
      const [lat, lng] = toProj(o.x, o.y);
      const secili = seciliAt != null && o.at === seciliAt;
      const renk = o.bizimKill ? KILL : DEATH;
      L.circleMarker([lat, lng], {
        radius: secili ? 8 : 5,
        color: secili ? "#ffffff" : renk,
        weight: secili ? 2 : 1,
        fillColor: renk,
        fillOpacity: secili ? 1 : 0.72,
      })
        .bindTooltip(
          `<b>${o.bizimAile}</b> ${o.bizimKill ? "→" : "←"} ${o.rakipAile}` +
          `<br>${o.rakipKlan || "—"} · ${new Date(o.at).toLocaleTimeString("tr-TR")}`,
          { direction: "top", opacity: 0.95 },
        )
        .on("click", () => secRef.current?.(o.at))
        .addTo(katman);
    }
  }, [olaylar, seciliAt, ready]);

  // ── Kutuya otur
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !kutu) return;
    const [lat0, lng0] = toProj(kutu.x0, kutu.y0);
    const [lat1, lng1] = toProj(kutu.x1, kutu.y1);
    map.fitBounds([[Math.min(lat0, lat1), Math.min(lng0, lng1)], [Math.max(lat0, lat1), Math.max(lng0, lng1)]], {
      padding: [24, 24], animate: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  return <div ref={boxRef} className={className} style={{ background: "#0d0d10" }} />;
}
