"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users, UserPlus, BarChart3, Megaphone, Flag, Shield, Wrench,
  Map as MapIcon, Swords, Info, ChevronRight,
} from "lucide-react";
import { WarPerformanceTab } from "@/components/war-performance-tab";
import { TestShell, Card, Empty } from "@/components/test-shell";
import { Tag } from "./ui";

import UyelerTab from "./uyeler";
import BasvurularTab from "./basvurular";
import DuyurularTab from "./duyurular";
import KlanlarTab from "./klanlar";
import RollerTab from "./roller";
import AraclarTab from "./araclar";
import GeoTab from "./geo";

/**
 * Yönetim paneli.
 *
 * Sekmeler ayrı dosyalarda ve her biri kendi verisini açıldığında
 * çekiyor — eskiden panele girer girmez sekiz ayrı istek atılıyordu,
 * kimse klan listesine bakmasa bile.
 *
 * Savaş açma ve otomatik programlar artık burada değil; kendi ekranında
 * (/test/savaslar/yonetim). Panelde yalnızca oraya bir bağlantı var.
 */

type TabKey = "uyeler" | "basvurular" | "hasar" | "duyurular" | "klanlar" | "roller" | "araclar" | "geo";

const TABS: { key: TabKey; label: string; icon: React.ElementType; guildAdmin: boolean }[] = [
  { key: "uyeler",     label: "Üyeler",       icon: Users,     guildAdmin: true },
  { key: "basvurular", label: "Başvurular",   icon: UserPlus,  guildAdmin: true },
  { key: "hasar",      label: "Hasar Raporu", icon: BarChart3, guildAdmin: true },
  { key: "duyurular",  label: "Duyurular",    icon: Megaphone, guildAdmin: false },
  { key: "klanlar",    label: "Klanlar",      icon: Flag,      guildAdmin: false },
  { key: "roller",     label: "Roller",       icon: Shield,    guildAdmin: false },
  { key: "araclar",    label: "Araçlar",      icon: Wrench,    guildAdmin: false },
  { key: "geo",        label: "GeoGuessr",    icon: MapIcon,   guildAdmin: false },
];

type WarLite = { id: number; title: string; date: string };

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("uyeler");
  const [toast, setToast] = useState<string | null>(null);
  const [wars, setWars] = useState<WarLite[]>([]);

  const isSiteAdmin = session?.user.isAdmin ?? false;
  const isGuildAdmin = session?.user.isGuildAdmin ?? false;
  const allowed = isSiteAdmin || isGuildAdmin;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && !allowed) router.push("/test");
  }, [status, allowed, router]);

  // Klan yöneticisi site-admin sekmesine düşerse üyelere geri al
  useEffect(() => {
    if (!session || isSiteAdmin) return;
    if (!TABS.find((t) => t.key === tab)?.guildAdmin) setTab("uyeler");
  }, [session, isSiteAdmin, tab]);

  // Hasar sekmesi savaş listesi istiyor; yalnızca oraya girilince çekiliyor
  useEffect(() => {
    if (tab !== "hasar" || wars.length > 0) return;
    fetch("/api/wars").then((r) => (r.ok ? r.json() : [])).then(setWars);
  }, [tab, wars.length]);

  if (status === "loading") {
    return <TestShell title="Yönetim" subtitle="Yükleniyor…"><Empty>Panel geliyor…</Empty></TestShell>;
  }
  if (!allowed) {
    return (
      <TestShell title="Yönetim" subtitle="Yetki gerekiyor">
        <Empty>Bu ekran yalnızca yöneticiler içindir.</Empty>
      </TestShell>
    );
  }

  const visibleTabs = isSiteAdmin ? TABS : TABS.filter((t) => t.guildAdmin);
  const myGuild = session?.user.guild;

  return (
    <TestShell
      title={isSiteAdmin ? "Yönetim Paneli" : "Klan Yönetimi"}
      subtitle={isSiteAdmin
        ? "Üye, klan, rol ve duyuru yönetimi — savaşlar kendi ekranında."
        : "Klan üyelerini yönet, başvuruları değerlendir, hasar raporu gir."}
      aside={!isSiteAdmin && myGuild ? <Tag color={myGuild.color}>{myGuild.tag}</Tag> : null}
    >
      {toast && (
        <Card hi className="px-4 py-2.5 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-gold)" }}>{toast}</span>
        </Card>
      )}

      {/* Savaş yönetimi kendi ekranında; buradan oraya köprü */}
      <Link href="/test/savaslar/yonetim" className="block">
        <Card className="px-4 py-3 flex items-center gap-3 transition-colors hover:border-[rgba(232,180,81,.3)]">
          <Swords className="w-4 h-4 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Savaş Yönetimi</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: "var(--t-faint)" }}>
              Savaş aç, kademe ver, otomatik programları düzenle, Discord&apos;a gönder.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-faint)" }} />
        </Card>
      </Link>

      {/* Sekmeler */}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleTabs.map((t) => (
          <button key={t.key} className="t-tab" data-on={tab === t.key} onClick={() => setTab(t.key)}>
            <t.icon className="w-3.5 h-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Sekme içeriği — anahtarla monte edilip sökülüyor, veri de öyle */}
      {tab === "uyeler" && <UyelerTab isSiteAdmin={isSiteAdmin} flash={flash} />}
      {tab === "basvurular" && <BasvurularTab flash={flash} />}
      {tab === "hasar" && <WarPerformanceTab wars={wars} />}
      {tab === "duyurular" && <DuyurularTab flash={flash} />}
      {tab === "klanlar" && <KlanlarTab flash={flash} />}
      {tab === "roller" && <RollerTab flash={flash} />}
      {tab === "araclar" && <AraclarTab flash={flash} />}
      {tab === "geo" && <GeoTab flash={flash} />}

      <div className="pb-6" />
    </TestShell>
  );
}
