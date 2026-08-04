"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Send, Trash2 } from "lucide-react";

type Message = { role: "user" | "model"; content: string };
type ChatHistoryItem = { role: "user" | "model"; parts: [{ text: string }] };

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
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const history: ChatHistoryItem[] = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok) throw new Error("API hatası");
      const data = await res.json();
      setMessages([...newMessages, { role: "model", content: data.response }]);
    } catch {
      setMessages([...newMessages, { role: "model", content: "Bir hata oluştu. Lütfen tekrar dene." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (status === "loading") return null;

  return (
    <div className="fixed inset-0 md:left-56 flex flex-col bg-bdo-bg z-10 px-4 md:px-6 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 py-3.5 border-b border-bdo-border flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-bdo-surface border border-bdo-border flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-bdo-gold" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[13px] font-bold text-bdo-text-primary leading-tight">AI Asistan</h1>
          <p className="text-[11px] text-bdo-text-secondary leading-tight">Klan verilerini doğal dilde sorgula</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg text-bdo-text-secondary hover:text-red-400 hover:bg-red-400/8 transition-colors"
              title="Sohbeti temizle"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
          <span className="text-[10px] bg-bdo-surface border border-bdo-border text-bdo-text-secondary rounded-md px-2 py-1">
            Gemini 2.5 Flash
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 max-w-3xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="pt-6">
            <p className="text-[13px] text-bdo-text-muted text-center mb-5">
              Klan verilerin hakkında herhangi bir şey sor.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-[12px] text-bdo-text-muted bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2.5 hover:border-bdo-gold/30 hover:text-bdo-text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 ${
              msg.role === "user"
                ? "bg-bdo-gold text-bdo-bg text-[11px] font-bold"
                : "bg-bdo-surface border border-bdo-border"
            }`}>
              {msg.role === "user"
                ? (session?.user?.name?.[0]?.toUpperCase() ?? "U")
                : <Sparkles className="w-3 h-3 text-bdo-gold" strokeWidth={2} />
              }
            </div>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] ${
              msg.role === "user"
                ? "bg-bdo-surface-2 border border-bdo-border text-bdo-text-primary"
                : "bg-bdo-surface border border-bdo-border text-bdo-text-primary"
            }`}>
              {msg.role === "model" ? (
                <div className="ai-markdown leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto rounded-lg border border-bdo-border my-2">
                          <table className="!m-0">{children}</table>
                        </div>
                      ),
                    }}
                  >{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg flex-shrink-0 bg-bdo-surface border border-bdo-border flex items-center justify-center mt-0.5">
              <Sparkles className="w-3 h-3 text-bdo-gold" strokeWidth={2} />
            </div>
            <div className="bg-bdo-surface border border-bdo-border rounded-xl px-3.5 py-3">
              <div className="flex gap-1.5 items-center h-3">
                <span className="w-1.5 h-1.5 bg-bdo-gold/50 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-bdo-gold/50 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-bdo-gold/50 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-bdo-border pt-3 pb-3 max-w-3xl w-full mx-auto">
        {messages.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
            {SUGGESTED.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-[11px] text-bdo-text-secondary bg-bdo-surface border border-bdo-border rounded-full px-2.5 py-1 hover:border-bdo-gold/30 hover:text-bdo-text-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bir şey sor..."
            rows={1}
            className="flex-1 bg-bdo-surface border border-bdo-border rounded-xl px-3.5 py-2.5 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary resize-none focus:outline-none focus:border-bdo-gold/40 transition-colors min-h-[42px] max-h-32"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-[42px] h-[42px] rounded-xl bg-bdo-gold text-bdo-bg flex items-center justify-center disabled:opacity-30 hover:bg-bdo-gold-dim transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
