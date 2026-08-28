"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield, Swords, Gem, BookOpen, RotateCcw } from "lucide-react";
import { TestShell, Card, Head } from "@/components/app-shell";
import { ItemIcon } from "@/components/item-visuals";
import { gradeOf } from "@/lib/bdo-text";
import {
  SLOTS, BOOK_ROWS, BOOK_BASELINE, levelLabels,
  type GearItem, type LevelStats, type SlotKey,
} from "@/lib/gear";

/**
 * Kuşanım denemesi.
 *
 * Eşya listesi ve basma aralığı kendi veritabanımızdan; seviye başına
 * AP/DP bdocodex'ten (bizde o alanlar yok). Kitap bonusları sabit taban
 * olarak ekleniyor — klanda herkes bitirmiş durumda.
 */

type Secim = { itemId: number; level: number };

const TOPLAM_ALANLAR = [
  { key: "ap", label: "AP" },
  { key: "dp", label: "DP" },
  { key: "accuracy", label: "İsabet" },
  { key: "evasion", label: "Kaçınma" },
  { key: "damageReduction", label: "Hasar Azaltma" },
] as const;

export default function GearTest() {
  const [items, setItems] = useState<GearItem[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [sinif, setSinif] = useState<string>("");
  const [secim, setSecim] = useState<Partial<Record<SlotKey, Secim>>>({});
  const [statlar, setStatlar] = useState<Record<number, LevelStats[]>>({});
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/gear/catalog");
        const d = await r.json();
        if (!r.ok) { setHata(d.error ?? "Katalog getirilemedi."); return; }
        setItems(d.items);
        setClasses(d.classes);
        setSinif(d.classes[0] ?? "");
      } catch {
        setHata("Katalog getirilemedi.");
      } finally {
        setYukleniyor(false);
      }
    })();
  }, []);

  /** Bir eşyanın seviye tablosunu bir kez çekip saklar */
  const statGetir = useCallback(async (it: GearItem) => {
    setStatlar((s) => (s[it.itemId] ? s : { ...s, [it.itemId]: [] }));
    const r = await fetch(`/api/gear/stats?itemId=${it.itemId}&max=${it.maxEnhance}`);
    const d = await r.json();
    setStatlar((s) => ({ ...s, [it.itemId]: d.levels ?? [] }));
  }, []);

  /** Yuvaya uyan, sınıfa uygun eşyalar */
  const yuvaSecenek = useCallback(
    (slot: number) =>
      items.filter(
        (i) => i.slot === slot && (!i.classes || !sinif || i.classes.includes(sinif)),
      ),
    [items, sinif],
  );

  function sec(key: SlotKey, itemId: number) {
    if (!itemId) {
      setSecim((s) => { const k = { ...s }; delete k[key]; return k; });
      return;
    }
    const it = items.find((i) => i.itemId === itemId);
    if (!it) return;
    // Varsayilan olarak en yuksek seviye - kiyaslarken en cok bu isteniyor
    setSecim((s) => ({ ...s, [key]: { itemId, level: it.maxEnhance } }));
    if (!statlar[itemId]) statGetir(it);
  }

  const toplam = useMemo(() => {
    const t = {
      ap: BOOK_BASELINE.ap, dp: BOOK_BASELINE.dp,
      accuracy: BOOK_BASELINE.accuracy, evasion: BOOK_BASELINE.evasion,
      damageReduction: BOOK_BASELINE.damageReduction,
    };
    let bekleyen = 0;
    for (const s of Object.values(secim)) {
      if (!s) continue;
      const tablo = statlar[s.itemId];
      if (!tablo?.length) { bekleyen++; continue; }
      const sv = tablo.find((l) => l.level === s.level) ?? tablo[tablo.length - 1];
      t.ap += sv.ap; t.dp += sv.dp; t.accuracy += sv.accuracy;
      t.evasion += sv.evasion; t.damageReduction += sv.damageReduction;
    }
    return { ...t, bekleyen };
  }, [secim, statlar]);

  const secilenSayi = Object.keys(secim).length;

  return (
    <TestShell title="Kuşanım (deneme)"
               subtitle="Edana · Ölen Tanrı · Hükümran · KaraYıldız · Ekleta / Kharazad / Apeiron">
      {hata && (
        <Card className="mb-4">
          <p className="px-5 py-4 text-[13px]" style={{ color: "#ef5f5f" }}>{hata}</p>
        </Card>
      )}

      {/* Toplam */}
      <Card hi className="mb-4">
        <Head icon={Swords} title="Toplam"
              meta={`${secilenSayi}/${SLOTS.length} yuva`} />
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {TOPLAM_ALANLAR.map((a) => (
            <div key={a.key} className="t-chip flex items-center gap-1.5">
              <span style={{ color: "var(--t-faint)" }}>{a.label}</span>
              <b className="t-num text-[14px]" style={{ color: "var(--t-gold)" }}>
                {toplam[a.key]}
              </b>
            </div>
          ))}
          {toplam.bekleyen > 0 && (
            <span className="t-chip animate-pulse" style={{ color: "var(--t-faint)" }}>
              {toplam.bekleyen} eşyanın statı yükleniyor…
            </span>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Yuvalar */}
        <Card>
          <Head icon={Shield} title="Yuvalar" meta={
            classes.length ? (
              <select value={sinif} onChange={(e) => { setSinif(e.target.value); setSecim({}); }}
                      className="bg-transparent outline-none text-[12px]"
                      style={{ color: "var(--t-gold)" }}>
                {classes.map((c) => <option key={c} value={c} style={{ background: "var(--t-surface)" }}>{c}</option>)}
              </select>
            ) : undefined
          } />
          <div className="divide-y" style={{ borderColor: "var(--t-line)" }}>
            {SLOTS.map((sl) => {
              const secenekler = yuvaSecenek(sl.slot);
              const s = secim[sl.key];
              const it = s ? items.find((i) => i.itemId === s.itemId) : undefined;
              const tablo = s ? statlar[s.itemId] : undefined;
              const etiketler = it ? levelLabels(it.maxEnhance) : [];
              const sv = s && tablo?.length
                ? tablo.find((l) => l.level === s.level)
                : undefined;

              return (
                <div key={sl.key} className="px-4 py-2.5 flex items-center gap-3 t-row">
                  <span className="w-[92px] flex-shrink-0 text-[12px]"
                        style={{ color: "var(--t-faint)" }}>{sl.label}</span>

                  {it ? <ItemIcon item={{ ...it, id: it.id }} size={30} />
                      : <span className="w-[30px] h-[30px] rounded flex-shrink-0"
                              style={{ background: "var(--t-raised)" }} />}

                  <select
                    value={s?.itemId ?? ""}
                    onChange={(e) => sec(sl.key, Number(e.target.value))}
                    className="flex-1 min-w-0 h-[30px] px-2 rounded-[var(--t-r-sm)] text-[12.5px] outline-none"
                    style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                             color: it ? gradeOf(it.grade).color : "var(--t-faint)" }}>
                    <option value="" style={{ background: "var(--t-surface)" }}>— boş —</option>
                    {secenekler.map((o) => (
                      <option key={o.itemId} value={o.itemId}
                              style={{ background: "var(--t-surface)", color: gradeOf(o.grade).color }}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  {it && it.maxEnhance > 0 && (
                    <select
                      value={s?.level ?? 0}
                      onChange={(e) => setSecim((st) => ({
                        ...st, [sl.key]: { itemId: it.itemId, level: Number(e.target.value) },
                      }))}
                      className="w-[74px] h-[30px] px-1.5 rounded-[var(--t-r-sm)] text-[12px] outline-none flex-shrink-0"
                      style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                               color: "var(--t-text)" }}>
                      {etiketler.map((lab, lv) => (
                        <option key={lv} value={lv} style={{ background: "var(--t-surface)" }}>{lab}</option>
                      ))}
                    </select>
                  )}

                  <span className="w-[104px] flex-shrink-0 text-right text-[11.5px] t-num"
                        style={{ color: "var(--t-dim)" }}>
                    {sv
                      ? [sv.ap && `${sv.ap} AP`, sv.dp && `${sv.dp} DP`]
                          .filter(Boolean).join(" · ")
                      : s ? "…" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3" style={{ borderTop: "1px solid var(--t-line)" }}>
            <button className="t-tab" onClick={() => setSecim({})}>
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} /> Temizle
            </button>
          </div>
        </Card>

        {/* Kitaplar */}
        <div className="space-y-4">
          <Card>
            <Head icon={BookOpen} title="Kitap bonusları" meta="sabit" />
            <div className="px-5 py-3 space-y-1.5">
              {BOOK_ROWS.map((b) => (
                <div key={b.label} className="flex justify-between text-[12.5px]">
                  <span style={{ color: "var(--t-faint)" }}>{b.label}</span>
                  <b className="t-num" style={{ color: "var(--t-dim)" }}>{b.value}</b>
                </div>
              ))}
            </div>
            <p className="px-5 pb-4 text-[11px] leading-relaxed" style={{ color: "var(--t-faint)" }}>
              Klanda herkes bu kitapları bitirdiği için taban kabul edildi.
              Toplama yalnızca AP, DP, isabet, kaçınma ve hasar azaltma giriyor.
            </p>
          </Card>

          <Card>
            <Head icon={Gem} title="Veri kaynağı" />
            <p className="px-5 py-4 text-[11.5px] leading-relaxed" style={{ color: "var(--t-faint)" }}>
              Eşyalar ve basma aralığı kendi eşya veritabanımızdan geliyor.
              Seviye başına AP/DP bizde yok — o değerler bdocodex&apos;ten
              çekiliyor ve sunucuda saklanıyor.
            </p>
          </Card>
        </div>
      </div>

      {yukleniyor && (
        <p className="mt-4 text-[12.5px] animate-pulse" style={{ color: "var(--t-faint)" }}>
          Katalog yükleniyor…
        </p>
      )}
    </TestShell>
  );
}
