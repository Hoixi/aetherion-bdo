"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { WarCard } from "@/components/war-card";
import { CharacterCard } from "@/components/character-card";
import { GuildStats } from "@/components/guild-stats";
import { MiniCalendar } from "@/components/mini-calendar";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchData() {
      setLoading(true);
      const [warsRes, annRes, profileRes] = await Promise.all([
        fetch("/api/wars"),
        fetch("/api/announcements"),
        fetch("/api/user/profile"),
      ]);

      if (warsRes.ok) setWars(await warsRes.json());
      if (annRes.ok) setAnnouncements(await annRes.json());
      if (profileRes.ok) setUser(await profileRes.json());
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
      <div>
        <h1 className="text-2xl font-bold text-bdo-gold mb-1">Dashboard</h1>
        <p className="text-sm text-bdo-text-muted">Hoş geldin, {user.familyName || "Kahraman"}</p>
      </div>

      <CharacterCard
        familyName={user.familyName}
        className={user.class}
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
        <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Etkinlikler</h2>
        {wars.length === 0 ? (
          <p className="text-bdo-text-muted">Yaklaşan etkinlik yok.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {wars.slice(0, 4).map((war) => (
              <WarCard key={war.id} war={war} />
            ))}
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
