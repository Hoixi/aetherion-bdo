"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { WarCard } from "@/components/war-card";
import { DashboardHero } from "@/components/dashboard-hero";
import { GuildStats } from "@/components/guild-stats";
import Link from "next/link";

interface War {
  id: number;
  title: string;
  type: string;
  date: string;
  deadline: string | null;
  _count: { participants: number };
  participants: { status: string }[];
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  creator: { familyName: string; avatarUrl: string };
}

interface UserProfile {
  ap: number;
  dp: number;
  familyName: string;
  class: string;
  spec: string;
  avatarUrl: string;
  guild?: { id: number; name: string; tag: string; color: string } | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wars, setWars] = useState<War[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<{ id: number; type: string; maxSize: number; members: { userId: number }[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    async function fetchData() {
      setLoading(true);
      const [warsRes, annRes, profileRes, actRes] = await Promise.all([
        fetch("/api/wars"),
        fetch("/api/announcements"),
        fetch("/api/user/profile"),
        fetch("/api/activities"),
      ]);
      if (warsRes.ok) setWars(await warsRes.json());
      if (annRes.ok) setAnnouncements(await annRes.json());
      if (profileRes.ok) setUser(await profileRes.json());
      if (actRes.ok) setActivities(await actRes.json());
      setLoading(false);
    }
    fetchData();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 bg-bdo-gold/40 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-bdo-gold/40 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-bdo-gold/40 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (!session || !user) return null;

  const upcomingWars = wars.filter((w) => new Date(w.date) >= new Date());
  const pastWars = wars.filter((w) => new Date(w.date) < new Date()).slice(0, 2);

  const TYPE_LABELS: Record<string, string> = {
    KARA_TAPINAK: "Kara Tapınak",
    KAN_ALTARI: "Kan Altarı",
    PARTI_SLOTLARI: "Parti Slotları",
  };

  return (
    <div>
      <DashboardHero
        familyName={user.familyName}
        classId={user.class}
        spec={user.spec}
        ap={user.ap}
        dp={user.dp}
        avatarUrl={user.avatarUrl}
        guildName={user.guild?.name}
        guildTag={user.guild?.tag}
        guildColor={user.guild?.color}
      />

      <GuildStats />

      {/* Savaşlar + Etkinlikler + Duyurular */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        {/* Savaşlar */}
        <div className="card md:col-span-2">
          <div className="card-header">
            <div>
              <p className="card-title">Savaşlar ve Etkinlikler</p>
              <p className="text-[11px] text-bdo-text-secondary mt-0.5">Yaklaşan savaşları takip et, katılım durumunu belirt</p>
            </div>
            <Link href="/wars" className="card-meta hover:text-bdo-gold transition-colors text-xs">Tümü →</Link>
          </div>
          {upcomingWars.length === 0 && pastWars.length === 0 ? (
            <div className="px-4 py-8 text-center text-bdo-text-muted text-sm">
              Yaklaşan savaş yok.
            </div>
          ) : (
            <>
              {upcomingWars.slice(0, 4).map((war) => (
                <WarCard key={war.id} war={war} />
              ))}
              {pastWars.length > 0 && upcomingWars.length === 0 && pastWars.map((war) => (
                <WarCard key={war.id} war={war} />
              ))}
            </>
          )}
        </div>

        {/* Duyurular + Etkinlikler */}
        <div className="space-y-4">
          {announcements.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Duyurular</span>
              </div>
              {announcements.slice(0, 3).map((a) => (
                <div key={a.id} className="card-row flex-col items-start gap-1">
                  <div className="flex items-center justify-between w-full">
                    <p className="text-[13px] font-medium text-bdo-gold">{a.title}</p>
                    <span className="text-[10px] text-bdo-text-secondary flex-shrink-0 ml-2">
                      {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="text-[12px] text-bdo-text-muted leading-relaxed">{a.content}</p>
                  <p className="text-[10px] text-bdo-text-secondary">— {a.creator.familyName}</p>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Aktif Etkinlikler</span>
              <Link href="/etkinlikler" className="card-meta hover:text-bdo-gold transition-colors">Tümü →</Link>
            </div>
            {activities.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-[12px] text-bdo-text-muted mb-2">Aktif etkinlik yok.</p>
                <Link href="/etkinlikler" className="text-[11px] text-bdo-gold hover:underline">Oluştur →</Link>
              </div>
            ) : (
              activities.slice(0, 4).map((a) => (
                <Link key={a.id} href="/etkinlikler" className="card-row justify-between">
                  <span className="text-[13px] text-bdo-text-primary">{TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className={`text-[11px] font-mono font-bold ${a.members.length >= a.maxSize ? "text-red-400" : "text-emerald-400"}`}>
                    {a.members.length}/{a.maxSize}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
