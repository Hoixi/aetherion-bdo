"use client";

import { useState } from "react";

export function MobileLoginGenerator() {
  const [loginUrl, setLoginUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateToken() {
    setLoading(true);
    setCopied(false);
    try {
      const res = await fetch("/api/mobile-token", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLoginUrl(data.loginUrl);
        setExpiresAt(data.expiresAt);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
      const input = document.createElement("input");
      input.value = loginUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const timeLeft = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000 / 60))
    : 0;

  return (
    <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-bdo-gold/10 border border-bdo-gold/20 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-bdo-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-bdo-text-primary">Mobil Giriş</h2>
          <p className="text-xs text-bdo-text-muted">VPN olmadan telefondan giriş yapın</p>
        </div>
      </div>

      <p className="text-sm text-bdo-text-muted">
        Tek kullanımlık bir link oluşturun ve telefonunuzda açın. Link 5 dakika geçerlidir ve sadece bir kez kullanılabilir.
      </p>

      {!loginUrl ? (
        <button
          onClick={generateToken}
          disabled={loading}
          className="w-full bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold font-semibold text-sm py-2.5 rounded-lg hover:bg-bdo-gold/20 transition-colors disabled:opacity-50"
        >
          {loading ? "Oluşturuluyor..." : "Mobil Giriş Linki Oluştur"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-bdo-bg border border-bdo-border rounded-lg p-3">
            <p className="text-xs text-bdo-text-muted mb-1.5 flex items-center justify-between">
              <span>Giriş Linki</span>
              <span className="text-bdo-gold">{timeLeft > 0 ? `${timeLeft} dk kaldı` : "Süresi doldu"}</span>
            </p>
            <p className="text-xs text-bdo-text-primary break-all font-mono leading-relaxed">{loginUrl}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold font-semibold text-sm py-2 rounded-lg hover:bg-bdo-gold/20 transition-colors"
            >
              {copied ? "✓ Kopyalandı!" : "Linki Kopyala"}
            </button>
            <button
              onClick={generateToken}
              disabled={loading}
              className="px-4 bg-bdo-surface border border-bdo-border text-bdo-text-muted text-sm py-2 rounded-lg hover:text-bdo-text-primary transition-colors disabled:opacity-50"
            >
              Yenile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
