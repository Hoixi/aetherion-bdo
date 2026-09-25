import type { Map as LeafletMap } from "leaflet";

/**
 * Kill/ölüm yoğunluk katmanı.
 *
 * Tek bir "olay yoğunluğu" yerine iki ayrı alan hesaplanıyor: öldüğümüz
 * yerler ve öldürdüğümüz yerler. Renk ikisinin dengesinden çıkıyor —
 * kırmızı bölgede biz ölmüşüz, yeşil bölgede karşı taraf. Parlaklık ise
 * toplam yoğunluk: soluk yeşil "bir kişiyi öldürmüşüz", parlak kırmızı
 * "burada dağılmışız" demek.
 *
 * Ölçek ekran pikselinde: yakınlaştırınca lekeler ayrışıyor, uzaklaşınca
 * birleşiyor. Bu bir alan hâkimiyeti ölçüsü değil, olayların nerede
 * toplandığını gösteriyor.
 */

export type IsiNoktasi = { nokta: [number, number]; kill: boolean };

/** Yeşil → sarı → kırmızı; dengeye göre ara renk */
const YESIL = [95, 211, 154] as const;
const SARI = [232, 180, 81] as const;
const KIRMIZI = [239, 95, 95] as const;

function renk(denge: number): [number, number, number] {
  // denge: -1 tamamen bizim kill, +1 tamamen bizim ölüm
  const [a, b, t] = denge < 0
    ? [YESIL, SARI, denge + 1]
    : [SARI, KIRMIZI, denge];
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function isiKatmani(map: LeafletMap, noktalar: IsiNoktasi[], yaricap = 44) {
  const tuval = document.createElement("canvas");
  tuval.className = "olay-isi";
  Object.assign(tuval.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "350" });
  tuval.setAttribute("aria-hidden", "true");
  map.getPanes().overlayPane.appendChild(tuval);

  // İki yoğunluk alanı ayrı tuvalde toplanıyor, sonra piksel piksel birleşiyor
  const olum = document.createElement("canvas");
  const oldurme = document.createElement("canvas");
  let bekleyen = 0, kapandi = false;

  const alanCiz = (hedef: HTMLCanvasElement, liste: IsiNoktasi[], w: number, h: number) => {
    hedef.width = w; hedef.height = h;
    const ctx = hedef.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    for (const n of liste) {
      const p = map.latLngToContainerPoint(n.nokta);
      if (p.x < -yaricap || p.y < -yaricap || p.x > w + yaricap || p.y > h + yaricap) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, yaricap);
      g.addColorStop(0, "rgba(0,0,0,.30)");
      g.addColorStop(0.55, "rgba(0,0,0,.12)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p.x - yaricap, p.y - yaricap, yaricap * 2, yaricap * 2);
    }
    return ctx.getImageData(0, 0, w, h).data;
  };

  const ciz = () => {
    bekleyen = 0;
    if (kapandi) return;
    const kaynak = map.containerPointToLayerPoint([0, 0]);
    tuval.style.transform = `translate(${kaynak.x}px,${kaynak.y}px)`;
    const olcu = map.getSize();
    const w = olcu.x, h = olcu.y;
    if (!w || !h) return;
    tuval.width = w; tuval.height = h;
    const cikti = tuval.getContext("2d");
    if (!cikti) return;

    const o = alanCiz(olum, noktalar.filter((n) => !n.kill), w, h);
    const k = alanCiz(oldurme, noktalar.filter((n) => n.kill), w, h);
    if (!o || !k) return;

    const resim = cikti.createImageData(w, h);
    for (let i = 3; i < resim.data.length; i += 4) {
      const od = o[i], kd = k[i];
      const toplam = od + kd;
      if (toplam < 8) continue;                         // gürültüyü basma
      const [r, g, b] = renk((od - kd) / toplam);
      const yogunluk = Math.min(1, toplam / 150);
      resim.data[i - 3] = r; resim.data[i - 2] = g; resim.data[i - 1] = b;
      // Eğri: az yoğunlukta bile görünsün, çoğunlukta doymasın
      resim.data[i] = Math.round(225 * Math.pow(yogunluk, 0.7));
    }
    cikti.putImageData(resim, 0, 0);
  };

  const planla = () => { if (!bekleyen && !kapandi) bekleyen = requestAnimationFrame(ciz); };
  map.on("move zoom resize", planla);
  planla();
  return () => {
    kapandi = true;
    cancelAnimationFrame(bekleyen);
    map.off("move zoom resize", planla);
    tuval.remove();
  };
}
