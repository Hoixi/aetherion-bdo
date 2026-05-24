"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline } from "leaflet";
// Static import → CSS bundled with the component, no async CDN load
import "leaflet/dist/leaflet.css";

// ── BDO World tile constants ─────────────────────────────────────────────────
// Tile URL: https://bdocodex.com/zonemap/main/{z}/{x}/{y}.webp
// Available zoom levels: 1–9
// At zoom 3 (scale = 2^3 = 8, tileSize = 256):
//   tile_x = ⌊lng × 8 / 256⌋  →  x=1..5  →  lng ∈ [32, 192)
//   tile_y = ⌊−lat × 8 / 256⌋ →  y=3..6  →  lat ∈ (−224, −96]
export const TILE_URL = "https://bdocodex.com/zonemap/main/{z}/{x}/{y}.webp";

// Main BDO world bounds in Leaflet CRS.Simple coordinates
const Z3 = Math.pow(2, 3); // 8
const T  = 256;             // tile size

export const SW_LAT = -(7 * T) / Z3; // −224  south edge of tile y=6
export const NE_LAT = -(3 * T) / Z3; // −96   north edge of tile y=3
export const SW_LNG =  (1 * T) / Z3; //  32   west  edge of tile x=1
export const NE_LNG =  (6 * T) / Z3; //  192  east  edge of tile x=5 (exclusive)

const LAT_RANGE = NE_LAT - SW_LAT; //  128
const LNG_RANGE = NE_LNG - SW_LNG; //  160
const PAN_PADDING = 0.5;

export const BDO_CENTER: [number, number] = [
  (SW_LAT + NE_LAT) / 2,  // −160
  (SW_LNG + NE_LNG) / 2,  //  112
];

/** Our [0,1] space → Leaflet LatLng (CRS.Simple) */
export function normToLatLng(x: number, y: number): [number, number] {
  return [
    NE_LAT - y * LAT_RANGE,  // y=0 → north (−96),  y=1 → south (−224)
    SW_LNG + x * LNG_RANGE,  // x=0 → west  (32),   x=1 → east  (192)
  ];
}

/** Leaflet LatLng (CRS.Simple) → our [0,1] space */
export function latLngToNorm(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - SW_LNG) / LNG_RANGE,
    y: (NE_LAT - lat) / LAT_RANGE,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export interface MapMarker {
  x: number;
  y: number;
  color: "blue" | "green" | "red";
  label?: string;
}

interface Props {
  onPick?: (x: number, y: number) => void;
  markers?: MapMarker[];
  className?: string;
  initialZoom?: number;
}

export function BdoLeafletMap({
  onPick,
  markers = [],
  className = "",
  initialZoom = 3,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<LeafletMap | null>(null);
  const overlayRefs   = useRef<(LeafletMarker | Polyline)[]>([]);
  const resizeRef     = useRef<ResizeObserver | null>(null);
  // Keep a stable ref to onPick so the React onClick handler always sees the
  // latest value without needing the map to be re-created.
  const onPickRef     = useRef(onPick);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  // ── Init map (once) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const worldBounds = L.latLngBounds(
        [SW_LAT, SW_LNG],
        [NE_LAT, NE_LNG],
      );
      const panBounds = worldBounds.pad(PAN_PADDING);

      const map = L.map(containerRef.current!, {
        crs: L.CRS.Simple,
        minZoom: 1,
        maxZoom: 9,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        zoomControl: true,
        attributionControl: false,
        // Soft boundary — lets the user pan/zoom freely so edge tiles render
        // but snaps back when they release.
        maxBounds: panBounds,
        maxBoundsViscosity: 0.8,
      });

      // ── Tile layer — NO bounds param so all zoom levels load freely ────────
      L.tileLayer(TILE_URL, {
        tileSize: 256,
        noWrap: true,
        minZoom: 1,
        maxZoom: 9,
        // errorTileUrl: "" keeps failed tiles transparent instead of broken-img
      }).addTo(map);

      const syncViewport = () => {
        const el = containerRef.current;
        if (!el) return;

        const panLatRange = LAT_RANGE * (1 + PAN_PADDING * 2);
        const panLngRange = LNG_RANGE * (1 + PAN_PADDING * 2);
        const minCoverZoom = Math.max(
          1,
          Math.min(
            9,
            Math.ceil(Math.log2(Math.max(el.clientWidth / panLngRange, el.clientHeight / panLatRange)) * 4) / 4,
          ),
        );

        map.setMinZoom(minCoverZoom);
        if (map.getZoom() < minCoverZoom) {
          map.setZoom(Math.max(initialZoom, minCoverZoom), { animate: false });
        }
        map.panInsideBounds(panBounds, { animate: false });
      };

      map.fitBounds(worldBounds);
      map.setZoom(initialZoom);
      syncViewport();

      // NOTE: We intentionally do NOT attach map.on('click', ...) here.
      // Leaflet's click handler relies on getBoundingClientRect() for coordinate
      // conversion which mismatches offsetHeight in flex/fixed layouts, producing
      // a dead zone in the upper portion of the map. Instead we intercept clicks
      // at the React layer (see onClick below) and use containerPointToLatLng()
      // which only needs the map's internal pan/zoom state — no DOM measurement.

      mapRef.current = map;

      // Leaflet reads container dimensions at init time. In a flex / fixed
      // layout the browser may not have finished painting, so we invalidate
      // the size at several points to guarantee correct tile rendering.
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        syncViewport();
        // Second rAF — runs after the browser has committed the first paint
        requestAnimationFrame(() => {
          map.invalidateSize({ animate: false });
          syncViewport();
        });
      });
      setTimeout(() => { map.invalidateSize({ animate: false }); syncViewport(); }, 150);
      setTimeout(() => { map.invalidateSize({ animate: false }); syncViewport(); }, 500);
      setTimeout(() => { map.invalidateSize({ animate: false }); syncViewport(); }, 1000);

      // Re-invalidate on any container resize (window resize, panel open/close, etc.)
      // Watch the OUTER wrapper (className div) — that's what flex resizes.
      // The inner absolute div tracks it silently, but ResizeObserver on it may
      // not fire if only the outer div changed without a reflow of the inner.
      resizeRef.current = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
        syncViewport();
      });
      // Observe both the Leaflet container AND its positioned parent
      if (containerRef.current) {
        resizeRef.current.observe(containerRef.current);
        if (containerRef.current.parentElement) {
          resizeRef.current.observe(containerRef.current.parentElement);
        }
      }
    });

    return () => {
      resizeRef.current?.disconnect();
      resizeRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers whenever they change ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      // Remove previous overlays
      overlayRefs.current.forEach((o) => o.remove());
      overlayRefs.current = [];

      const COLORS: Record<string, string> = {
        blue:  "#3b82f6",
        green: "#22c55e",
        red:   "#ef4444",
      };

      markers.forEach(({ x, y, color, label }) => {
        const [lat, lng] = normToLatLng(x, y);

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              position:relative;
              width:16px; height:16px; border-radius:50%;
              background:${COLORS[color] ?? "#fff"};
              border:2.5px solid white;
              box-shadow:0 0 6px rgba(0,0,0,.7);
            "></div>
            ${label ? `<div style="
              position:absolute; top:18px; left:50%; transform:translateX(-50%);
              background:rgba(0,0,0,.75); color:#fff; font-size:10px; font-weight:600;
              padding:1px 5px; border-radius:3px; white-space:nowrap;
            ">${label}</div>` : ""}
          `,
          iconSize:   [16, 16],
          iconAnchor: [8,  8],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        overlayRefs.current.push(marker);
      });

      // Dashed line between first two markers
      if (markers.length >= 2) {
        const [lat1, lng1] = normToLatLng(markers[0].x, markers[0].y);
        const [lat2, lng2] = normToLatLng(markers[1].x, markers[1].y);
        const line = L.polyline([[lat1, lng1], [lat2, lng2]], {
          color: "white",
          dashArray: "5 4",
          weight: 2,
          opacity: 0.75,
        }).addTo(map);
        overlayRefs.current.push(line as unknown as LeafletMarker);
      }
    });
  }, [markers]);

  // The outer div establishes the flex / grid cell size (className controls this).
  // The inner div is absolute-filled so Leaflet always gets a stable, exact rect.
  //
  // Click handling bypasses Leaflet's map.on('click') entirely — that API reads
  // getBoundingClientRect() which produces wrong values in flex/fixed layouts and
  // creates dead zones. Instead we intercept the React synthetic onClick, compute
  // the cursor offset relative to the wrapper's own bounding rect, and feed that
  // pixel point to containerPointToLatLng() which only uses the map's internal
  // pan/zoom matrices, completely avoiding the DOM-measurement problem.
  return (
    <div
      className={className}
      style={{ position: "relative", minHeight: 0 }}
      onPointerDownCapture={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUpCapture={(e) => {
        if (!onPickRef.current || !mapRef.current || !containerRef.current) return;
        if ((e.target as HTMLElement).closest(".leaflet-control")) return;
        // Ignore drag: if the pointer moved more than 5 px it was a pan, not a pick
        const down = pointerDownPos.current;
        if (
          down &&
          (Math.abs(e.clientX - down.x) > 5 || Math.abs(e.clientY - down.y) > 5)
        ) return;

        // ── Direct CRS.Simple math — no dependency on Leaflet's cached _size ──
        //
        // Leaflet's containerPointToLatLng internally uses map._pixelOrigin which
        // is computed from map._size (the container dimensions cached at init time).
        // In a flex / fixed layout _size is often captured before the browser
        // finishes painting, so it may be smaller than the actual rendered container,
        // creating dead zones at the edges.
        //
        // For CRS.Simple the projection is purely linear, so we can derive lat/lng
        // from first principles using only the map's current center + zoom plus the
        // actual rendered rect — no Leaflet internal caches involved:
        //
        //   lat = center.lat − (py − h/2) / scale
        //   lng = center.lng + (px − w/2) / scale
        //
        // where px/py are pixel offsets from the container top-left,
        // and scale = 2^zoom (pixels per CRS unit at the current zoom level).
        const rect   = containerRef.current.getBoundingClientRect();
        const px     = e.clientX - rect.left;
        const py     = e.clientY - rect.top;
        const scale  = Math.pow(2, mapRef.current.getZoom());
        const center = mapRef.current.getCenter();
        const lng    = center.lng + (px - rect.width  / 2) / scale;
        const lat    = center.lat - (py - rect.height / 2) / scale;

        const norm = latLngToNorm(lat, lng);
        onPickRef.current(norm.x, norm.y);
      }}
    >
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, background: "#1a1a2e" }}
      />
    </div>
  );
}
