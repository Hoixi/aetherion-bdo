"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ProfileForm } from "@/components/profile-form";
import { CharacterCard } from "@/components/character-card";
import { MobileLoginGenerator } from "@/components/mobile-login-generator";
import { UserPerformanceStats } from "@/components/user-performance-stats";
import { getTypeName } from "@/lib/classes";

interface Participation {
  id: number;
  war: { id: number; title: string; type: string; date: string };
}

interface UserProfile {
  familyName: string;
  ap: number;
  dp: number;
  class: string;
  spec: string;
  avatarUrl: string;
  participations: Participation[];
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchProfile() {
      setLoading(true);
      const res = await fetch("/api/user/profile");
      if (res.ok) setUser(await res.json());
      setLoading(false);
    }

    fetchProfile();
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
      <h1 className="text-2xl font-bold text-bdo-gold">Profil</h1>

      <CharacterCard
        familyName={user.familyName}
        className={user.class}
        spec={user.spec}
        ap={user.ap}
        dp={user.dp}
        avatarUrl={user.avatarUrl}
      />

      <div>
        <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Bilgileri Düzenle</h2>
        <ProfileForm initialData={{ familyName: user.familyName, ap: user.ap, dp: user.dp, class: user.class, spec: user.spec }} />
      </div>

      <MobileLoginGenerator />

      <div>
        <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Hasar İstatistiklerim</h2>
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
          <UserPerformanceStats userId={session.user.id} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Etkinlik Geçmişi</h2>
        {user.participations.length === 0 ? (
          <p className="text-bdo-text-muted">Henüz katıldığınız etkinlik yok.</p>
        ) : (
          <div className="space-y-2">
            {user.participations.map((p) => (
              <div key={p.id} className="bg-bdo-surface border border-bdo-border rounded-lg p-3 flex items-center justify-between">
                <span className="text-bdo-text-primary">{p.war.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded">{getTypeName(p.war.type)}</span>
                  <span className="text-sm text-bdo-text-muted">{new Date(p.war.date).toLocaleDateString("tr-TR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
