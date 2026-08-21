"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { TestShell, Card } from "@/components/app-shell";

/**
 * AI asistan.
 *
 * Klan verilerini doğal dilde sorgular. Eski ekran kenar menüsüne göre
 * konumlanmış sabit bir katmandı; yeni kabukta üst menü olduğu için
 * sohbet normal akışta, kendi yüksekliğiyle duruyor.
 */

type Message = { role: "user" | "model"; content: string };
type HistoryItem = { role: "user" | "model"; parts: [{ text: string }] };

const SUGGESTED = [
  "Son 5 savaşta en çok hasar vuran üyeleri listele",
  "Katılım oranı en düşük 5 üyeyi göster",
  "En yüksek GS'e sahip 10 üyeyi sırala",
  "Klan sınıf dağılımını göster",
  "Son savaşta katılan ve katılmayan üyeleri listele",
  "Hangi üyelerin GS'i son 1 ayda arttı?",
  "Toplam kill sıralamasını göster",
  "Klan genel istatistiklerini özetle",
];

export default function AiAsistanPage() {
  const { data: session, status } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;

    const next = [...messages, { role: "user", content: text } as Message];
    setMessages(next);
    setInput("");
    setLoading(true);

    const history: HistoryItem[] = messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok) throw new Error("API hatası");
      const data = await res.json();
      setMessages([...next, { role: "model", content: data.response }]);
    } catch {
      setMessages([...next, { role: "model", content: "Bir hata oluştu. Lütfen tekrar dene." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  if (status === "unauthenticated") {
    return (
      <TestShell title="AI Asistan" subtitle="Giriş gerekiyor">
        <Card className="p-10 text-center">
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>
            Bu ekranı görmek için giriş yapman gerekiyor.
          </span>
        </Card>
      </TestShell>
    );
  }

  return (
    <TestShell
      title="AI Asistan"
      subtitle="Klan verilerini doğal dilde sorgula — sayılar veritabanından geliyor, uydurulmuyor."
      aside={
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} title="Sohbeti temizle"
                    className="t-chip inline-flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Temizle
            </button>
          )}
          <span className="t-chip hidden sm:inline">Gemini 2.5 Flash</span>
        </div>
      }
    >
      <Card className="flex flex-col overflow-hidden" >
        {/* ── Sohbet ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4"
             style={{ height: "min(62vh, 620px)" }}>
          {messages.length === 0 && (
            <div className="pt-4 max-w-3xl mx-auto w-full">
              <p className="text-[13px] text-center mb-5" style={{ color: "var(--t-dim)" }}>
                Klan verilerin hakkında istediğini sor.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED.map((s) => (
                  <button key={s} onClick={() => send(s)}
                          className="text-left text-[12px] px-3 py-2.5 rounded-[var(--t-r-sm)] transition-colors hover:border-[rgba(232,180,81,.3)]"
                          style={{ color: "var(--t-dim)", background: "var(--t-raised)",
                                   border: "1px solid var(--t-line)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto w-full space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className="w-6 h-6 rounded-lg flex-shrink-0 grid place-items-center mt-0.5 text-[11px] font-bold"
                     style={m.role === "user"
                       ? { background: "var(--t-gold)", color: "#0b0b0c" }
                       : { background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                  {m.role === "user"
                    ? (session?.user?.name?.[0]?.toUpperCase() ?? "U")
                    : <Sparkles className="w-3 h-3" strokeWidth={2} style={{ color: "var(--t-gold)" }} />}
                </div>

                <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px]"
                     style={{
                       background: m.role === "user" ? "var(--t-raised)" : "var(--t-surface)",
                       border: "1px solid var(--t-line)",
                     }}>
                  {m.role === "model" ? (
                    <div className="ai-markdown leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto rounded-[var(--t-r-sm)] my-2"
                                 style={{ border: "1px solid var(--t-line)" }}>
                              <table className="!m-0">{children}</table>
                            </div>
                          ),
                        }}
                      >{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-lg flex-shrink-0 grid place-items-center mt-0.5"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                  <Sparkles className="w-3 h-3" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                </div>
                <div className="rounded-xl px-3.5 py-3"
                     style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
                  <div className="flex gap-1.5 items-center h-3">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ background: "rgba(232,180,81,.5)", animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Giriş ─────────────────────────────────────────────────── */}
        <div className="p-4" style={{ borderTop: "1px solid var(--t-line)" }}>
          <div className="max-w-3xl mx-auto w-full">
            {messages.length > 0 && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                {SUGGESTED.slice(0, 4).map((s) => (
                  <button key={s} onClick={() => send(s)}
                          className="flex-shrink-0 text-[11px] rounded-full px-2.5 py-1 transition-colors"
                          style={{ color: "var(--t-faint)", background: "var(--t-raised)",
                                   border: "1px solid var(--t-line)" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea ref={inputRef} value={input} rows={1} disabled={loading}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                        }}
                        onInput={(e) => {
                          const t = e.currentTarget;
                          t.style.height = "auto";
                          t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
                        }}
                        placeholder="Bir şey sor… (Shift+Enter satır atlar)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl text-[13px] resize-none outline-none min-h-[42px] max-h-32"
                        style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                 color: "var(--t-text)" }} />
              <button onClick={() => send(input)} disabled={loading || !input.trim()}
                      aria-label="Gönder"
                      className="w-[42px] h-[42px] rounded-xl grid place-items-center flex-shrink-0 disabled:opacity-30 transition-colors"
                      style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
                <Send className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="pb-6" />
    </TestShell>
  );
}
