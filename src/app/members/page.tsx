"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { MemberTable } from "@/components/member-table";

interface Member {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  siteRole?: { name: string; color: string } | null;
  _count?: { participations: number };
}

export default function MembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchMembers() {
      setLoading(true);
      const res = await fetch("/api/members");
      if (res.ok) setMembers(await res.json());
      setLoading(false);
    }

    fetchMembers();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-bdo-text-muted">Yükleniyor...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-bdo-gold">Üyeler</h1>
      <MemberTable members={members} />
    </div>
  );
}
