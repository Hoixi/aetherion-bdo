"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "model";
  content: string;
};

type ChatHistoryItem = {
  role: "user" | "model";
  parts: [{ text: string }];
};

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
      setMessages([...newMessages, { role: "model", content: "❌ Bir hata oluştu. Lütfen tekrar dene." }]);
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
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 border-b border-bdo-border flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-bdo-gold/15 flex items-center justify-center text-bdo-gold text-lg">✦</div>
        <div>
          <h1 className="text-bdo-text-primary font-semibold leading-tight">AI Asistan</h1>
          <p className="text-xs text-bdo-text-muted">Klan verilerinizi doğal dilde sorgulayın</p>
        </div>
        <span className="ml-auto text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full px-2 py-0.5">Gemini 2.0 Flash-001</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-bdo-text-muted text-center mt-4">
              Klan verileriniz hakkında herhangi bir şey sorun.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs text-bdo-text-secondary bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2.5 hover:border-bdo-gold/40 hover:text-bdo-gold transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
              msg.role === "user"
                ? "bg-bdo-gold text-bdo-bg"
                : "bg-bdo-gold/15 text-bdo-gold border border-bdo-gold/25"
            }`}>
              {msg.role === "user" ? (session?.user?.name?.[0]?.toUpperCase() ?? "U") : "✦"}
            </div>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-bdo-gold/10 border border-bdo-gold/20 text-bdo-text-primary"
                : "bg-bdo-surface border border-bdo-border text-bdo-text-primary"
            }`}>
              {msg.role === "model" ? (
                <div className="ai-markdown text-sm leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex-shrink-0 bg-bdo-gold/15 text-bdo-gold border border-bdo-gold/25 flex items-center justify-center text-xs font-bold mt-0.5">✦</div>
            <div className="bg-bdo-surface border border-bdo-border rounded-xl px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                <span className="w-1.5 h-1.5 bg-bdo-gold/60 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-bdo-gold/60 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-bdo-gold/60 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-bdo-border pt-3 pb-1">
        {messages.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {SUGGESTED.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-[11px] text-bdo-text-muted bg-bdo-surface border border-bdo-border rounded-full px-3 py-1 hover:border-bdo-gold/40 hover:text-bdo-gold transition-colors"
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
            placeholder="Bir şey sor... (Enter ile gönder, Shift+Enter yeni satır)"
            rows={1}
            className="flex-1 bg-bdo-surface border border-bdo-border rounded-xl px-4 py-3 text-sm text-bdo-text-primary placeholder-bdo-text-muted resize-none focus:outline-none focus:border-bdo-gold/50 transition-colors min-h-[48px] max-h-32"
            style={{ height: "auto" }}
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
            className="w-11 h-11 rounded-xl bg-bdo-gold text-bdo-bg flex items-center justify-center disabled:opacity-40 hover:bg-bdo-gold-dim transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-bdo-text-muted/50 text-center mt-2">
          Veriler anlık olarak veritabanından çekilir · Gemini 2.0 Flash-001
        </p>
      </div>
    </div>
  );
}
