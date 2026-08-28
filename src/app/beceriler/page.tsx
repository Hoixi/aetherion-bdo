"use client";

import { useState, useEffect, useMemo } from "react";
import { Swords, Search, Plus, X, Link2, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { TestShell, Card, Empty, loadJson } from "@/components/app-shell";

/**
 * Beceriler ve beceri eklentileri.
 *
 * Eklenti kataloğu (96 etki) extractor'ın build çıktısında yok — sadece
 * lokalizasyon tablosu 33'te duruyor ve boru hattı oradan alıyor. Bu yüzden
 * elimizde etkilerin tam listesi var ama "hangi beceri hangi etkiyi alabilir"
 * eşlemesi YOK; o tablo henüz çözülmüyor. Ekran bunu gizlemiyor: seçim
 * serbest, oyunda geçerliliğini kullanıcı biliyor.
 */

interface SkillRank { rank: number; name: string; description: string | null; skillLevel?: number }
interface SkillGroup { id: string; name: string; classes: number[]; ranks: SkillRank[] }
interface SkillClass { key: number; name: string }
interface AddonEffect { id: number; text: string }

interface Payload { classes: SkillClass[]; skills: SkillGroup[]; addons: AddonEffect[] }

export default function BecerilerPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sinif, setSinif] = useState<number | null>(() => Number(params.get("sinif")) || null);
  const [q, setQ] = useState("");
  const [secili, setSecili] = useState<string | null>(null);
  const [eklentiler, setEklentiler] = useState<number[]>(() =>
    (params.get("ek") ?? "").split("-").map(Number).filter((n) => n > 0));
  const [ekleniyor, setEkleniyor] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = sinif ? `&sinif=${sinif}` : "";
    loadJson<Payload>(`/api/kurulum?ne=beceri${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sinif]);

  const skills = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLocaleLowerCase("tr");
    return needle
      ? data.skills.filter((s) => s.name.toLocaleLowerCase("tr").includes(needle))
      : data.skills;
  }, [data, q]);

  const skill = useMemo(
    () => data?.skills.find((s) => s.id === secili) ?? null, [data, secili]);

  const chosenAddons = useMemo(
    () => eklentiler.map((id) => data?.addons.find((a) => a.id === id)).filter(Boolean) as AddonEffect[],
    [eklentiler, data]);

  const sync = (next: number[], nextSinif = sinif) => {
    setEklentiler(next);
    const qs = new URLSearchParams();
    if (nextSinif) qs.set("sinif", String(nextSinif));
    if (next.length) qs.set("ek", next.join("-"));
    router.replace(qs.toString() ? `/beceriler?${qs}` : "/beceriler", { scroll: false });
  };

  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  if (error) return <TestShell title="Beceriler"><Empty>{error}</Empty></TestShell>;
  if (loading && !data) return <TestShell title="Beceriler"><Empty>Yükleniyor…</Empty></TestShell>;

  return (
    <TestShell title="Beceriler & Eklentiler"
               subtitle={`${data?.skills.length ?? 0} beceri · ${data?.addons.length ?? 0} eklenti etkisi`}>
      <div className="grid gap-4">
        {/* ── Sınıf seçimi ── */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button className="t-chip" onClick={() => { setSinif(null); setSecili(null); }}
                    style={sinif === null ? { borderColor: "var(--t-gold)", color: "var(--t-gold)" } : undefined}>
              Tüm sınıflar
            </button>
            {data?.classes.map((c) => (
              <button key={c.key} className="t-chip"
                      onClick={() => { setSinif(c.key); setSecili(null); }}
                      style={sinif === c.key ? { borderColor: "var(--t-gold)", color: "var(--t-gold)" } : undefined}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-[9px] mt-3"
               style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--t-faint)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Beceri ara…"
                   className="flex-1 bg-transparent outline-none text-[13.5px]"
                   style={{ color: "var(--t-text)" }} />
          </div>
        </Card>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {/* ── Beceri listesi ── */}
          <Card>
            <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <Swords className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
              <h2 className="text-[13.5px] font-semibold">Beceriler</h2>
              <span className="t-chip ml-auto">{skills.length}</span>
            </div>
            <div className="p-2 max-h-[520px] overflow-y-auto flex flex-col gap-0.5">
              {skills.length === 0 && (
                <p className="text-[12.5px] text-center py-6" style={{ color: "var(--t-faint)" }}>
                  Beceri yok.
                </p>
              )}
              {skills.map((s) => (
                <button key={s.id} onClick={() => setSecili(s.id)}
                        className="item-chip text-left px-2.5 py-1.5 rounded-[8px] text-[12.5px]"
                        style={{
                          ["--item-grade" as string]: "var(--t-gold)",
                          color: secili === s.id ? "var(--t-gold)" : "var(--t-text)",
                          borderColor: secili === s.id ? "var(--t-gold)" : undefined,
                        }}>
                  {s.name}
                  <span className="ml-2 text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                    {s.ranks.length} kademe
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* ── Seçili beceri ── */}
          <Card>
            <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <h2 className="text-[13.5px] font-semibold">
                {skill ? skill.name : "Beceri seç"}
              </h2>
            </div>
            {!skill ? (
              <p className="text-[12.5px] px-5 py-4" style={{ color: "var(--t-faint)" }}>
                Soldan bir beceri seç, kademeleri burada çıksın.
              </p>
            ) : (
              <div className="p-4 flex flex-col gap-2 max-h-[520px] overflow-y-auto">
                {skill.ranks.map((r) => (
                  <div key={r.rank} className="rounded-[9px] p-2.5"
                       style={{ border: "1px solid var(--t-line)", background: "var(--t-raised)" }}>
                    <div className="flex items-baseline gap-2">
                      <span className="t-num text-[11px]" style={{ color: "var(--t-gold)" }}>
                        {r.rank}
                      </span>
                      <span className="text-[12.5px]">{r.name}</span>
                    </div>
                    {r.description && (
                      <p className="text-[11.5px] mt-1" style={{ color: "var(--t-dim)" }}>
                        {r.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Eklentiler ── */}
        <Card>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <h2 className="text-[13.5px] font-semibold">Beceri eklentileri</h2>
            <button onClick={() => setEkleniyor(true)} className="t-chip ml-auto inline-flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> Etki ekle
            </button>
            <button onClick={share} className="t-chip inline-flex items-center gap-1.5">
              {copied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
              {copied ? "Kopyalandı" : "Link"}
            </button>
          </div>

          {chosenAddons.length === 0 ? (
            <p className="text-[12.5px] px-5 py-4" style={{ color: "var(--t-faint)" }}>
              Henüz eklenti seçilmedi.
            </p>
          ) : (
            <div className="p-3 flex flex-col gap-1.5">
              {chosenAddons.map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-2.5 py-2 rounded-[9px] text-[12.5px]"
                     style={{ border: "1px solid var(--t-line)", background: "var(--t-raised)" }}>
                  <span className="flex-1">{a.text}</span>
                  <button onClick={() => sync(eklentiler.filter((id) => id !== a.id))} aria-label="Kaldır">
                    <X className="w-3.5 h-3.5" style={{ color: "var(--t-dim)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Etki seçici ── */}
      {ekleniyor && data && (
        <AddonPicker addons={data.addons} chosen={eklentiler}
                     onClose={() => setEkleniyor(false)}
                     onToggle={(id) => sync(
                       eklentiler.includes(id)
                         ? eklentiler.filter((x) => x !== id)
                         : [...eklentiler, id])} />
      )}
    </TestShell>
  );
}

/** Oyundaki "Etki Seç" penceresinin karşılığı. */
function AddonPicker({ addons, chosen, onClose, onToggle }: {
  addons: AddonEffect[]; chosen: number[];
  onClose: () => void; onToggle: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return needle ? addons.filter((a) => a.text.toLocaleLowerCase("tr").includes(needle)) : addons;
  }, [addons, q]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center p-4 pt-[8vh]"
         style={{ background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div className="t-card w-full max-w-[520px] max-h-[76vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <h3 className="text-[13.5px] font-semibold">Etki Seç</h3>
          <button onClick={onClose} className="ml-auto" aria-label="Kapat">
            <X className="w-4 h-4" style={{ color: "var(--t-dim)" }} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[9px]"
               style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--t-faint)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…"
                   className="flex-1 bg-transparent outline-none text-[13px]"
                   style={{ color: "var(--t-text)" }} />
          </div>
        </div>
        <div className="overflow-y-auto p-3 flex flex-col gap-1">
          {list.map((a) => {
            const on = chosen.includes(a.id);
            return (
              <button key={a.id} onClick={() => onToggle(a.id)}
                      className="item-chip text-left px-2.5 py-2 rounded-[9px] text-[12.5px]"
                      style={{
                        ["--item-grade" as string]: "var(--t-gold)",
                        borderColor: on ? "var(--t-gold)" : undefined,
                        color: on ? "var(--t-gold)" : "var(--t-text)",
                      }}>
                {a.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
