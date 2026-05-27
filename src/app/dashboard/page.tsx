"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { WarCard } from "@/components/war-card";
import { DashboardHero } from "@/components/dashboard-hero";
import { GuildStats } from "@/components/guild-stats";
import { MiniCalendar } from "@/components/mini-calendar";
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
        <p className="text-bdo-text-muted">Yükleniyor...</p>
      </div>
    );
  }

  if (!session || !user) return null;

  return (
    <div className="space-y-8">
      <DashboardHero
        familyName={user.familyName}
        classId={user.class}
        spec={user.spec}
        ap={user.ap}
        dp={user.dp}
        avatarUrl={user.avatarUrl}
      />

      <GuildStats />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
      {announcements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Duyurular</h2>
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-gradient-to-br from-bdo-surface to-bdo-gradient-end border border-bdo-gold/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-bdo-gold font-semibold">{a.title}</h3>
                  <span className="text-xs text-bdo-text-muted">
                    {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                  </span>
                </div>
                <p className="text-sm text-bdo-text-secondary">{a.content}</p>
                <div className="mt-2 text-xs text-bdo-text-muted">— {a.creator.familyName}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Savaşlar</h2>
        {wars.length === 0 ? (
          <p className="text-bdo-text-muted">Yaklaşan savaş yok.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {wars.slice(0, 4).map((war) => (
              <WarCard key={war.id} war={war} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-bdo-text-primary">Etkinlikler</h2>
          <Link href="/etkinlikler" className="text-xs text-bdo-gold hover:underline">Tümü →</Link>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-bdo-text-muted">Aktif etkinlik yok. <Link href="/etkinlikler" className="text-bdo-gold hover:underline">Oluştur →</Link></p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {activities.slice(0, 4).map((a) => {
              const typeLabels: Record<string, string> = { KARA_TAPINAK: "🏰 Kara Tapınak", KAN_ALTARI: "🩸 Kan Altarı", PARTI_SLOTLARI: "⚔️ Parti Slotları" };
              return (
                <Link key={a.id} href="/etkinlikler" className="bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 flex items-center justify-between hover:border-bdo-gold/30 transition-colors">
                  <span className="text-sm text-bdo-text-primary">{typeLabels[a.type] ?? a.type}</span>
                  <span className={`text-xs font-mono font-bold ${a.members.length >= a.maxSize ? "text-red-400" : "text-bdo-gold"}`}>
                    {a.members.length}/{a.maxSize}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
        </div>
        <div>
          <MiniCalendar />
        </div>
      </div>
    </div>
  );
}
