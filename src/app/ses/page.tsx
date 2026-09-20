"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Download } from "lucide-react";
import { TestShell, Empty } from "@/components/app-shell";
import "./ses.css";

/**
 * Sesli sohbet — tarayıcıdan. Uygulamayı indirmek istemeyenler için aynı
 * odalar, aynı sohbet, aynı ayarlar; farkı: bas-konuş yalnızca bu sekme
 * öndeyken çalışır ve sekme kapanınca ses gider. Overlay ve grind sayacı
 * yalnızca masaüstü uygulamasında. Gövde sunucuda çizilmez (Web Audio).
 */
const SesUygulama = dynamic(() => import("./uygulama"), { ssr: false, loading: () => <Empty>Ses katmanı yükleniyor…</Empty> });

export default function SesSayfasi() {
  const { status } = useSession();
  return (
    <TestShell
      title="Sesli Sohbet"
      subtitle="Odalar, klan sohbeti ve çevrimiçi üyeler — uygulamadakiyle aynı. Bas-konuş yalnızca bu sekme öndeyken çalışır."
      aside={
        <Link href="/uygulama" className="t-tab" title="Oyun içi bas-konuş, overlay ve grind sayacı için">
          <Download className="w-3.5 h-3.5" /> Masaüstü uygulaması
        </Link>
      }
    >
      {status === "loading" && <Empty>Yükleniyor…</Empty>}
      {status === "unauthenticated" && <Empty>Giriş yapman gerekiyor.</Empty>}
      {status === "authenticated" && <SesUygulama />}
    </TestShell>
  );
}
