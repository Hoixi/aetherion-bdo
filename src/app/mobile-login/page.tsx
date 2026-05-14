"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function MobileLoginContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Geçersiz link. Token bulunamadı.");
      return;
    }

    async function login() {
      try {
        const result = await signIn("mobile-token", {
          token,
          redirect: false,
        });

        if (result?.ok) {
          setStatus("success");
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1500);
        } else {
          setStatus("error");
          setErrorMsg("Token geçersiz veya süresi dolmuş. Lütfen yeni bir link oluşturun.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Bir hata oluştu. Lütfen tekrar deneyin.");
      }
    }

    login();
  }, [token]);

  return (
    <>
      {status === "loading" && (
        <div className="space-y-4">
          <div className="w-10 h-10 border-2 border-bdo-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-bdo-text-muted">Giriş yapılıyor...</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4">
          <div className="w-12 h-12 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-400 font-semibold">Giriş başarılı!</p>
          <p className="text-bdo-text-muted text-sm">Yönlendiriliyorsunuz...</p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <div className="w-12 h-12 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 font-semibold">Giriş başarısız</p>
          <p className="text-bdo-text-muted text-sm">{errorMsg}</p>
        </div>
      )}
    </>
  );
}

export default function MobileLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-3xl font-bold text-bdo-gold">⚔ AETHERION</div>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="w-10 h-10 border-2 border-bdo-gold border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-bdo-text-muted">Yükleniyor...</p>
            </div>
          }
        >
          <MobileLoginContent />
        </Suspense>
      </div>
    </div>
  );
}
