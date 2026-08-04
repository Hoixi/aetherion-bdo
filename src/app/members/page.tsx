"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { MemberTable } from "@/components/member-table";
import { PageHeader, Loading } from "@/components/ui";
import { Users } from "lucide-react";

interface Member {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  siteRole?: { name: string; color: string } | null;
  guild?: { id: number; name: string; tag: string; color: string } | null;
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

  if (status === "loading" || loading) return <Loading />;
  if (!session) return null;

  const guildCount = new Set(members.map((m) => m.guild?.id).filter(Boolean)).size;

  return (
    <div>
      <PageHeader
        title="Üyeler"
        desc="Tüm klanların kadrosu — gear score, class ve savaş katılımı."
        icon={Users}
        action={
          <span className="text-[11px] text-bdo-text-secondary">
            <span className="text-bdo-text-primary font-semibold font-mono">{members.length}</span> üye
            {guildCount > 1 && (
              <> · <span className="text-bdo-text-primary font-semibold font-mono">{guildCount}</span> klan</>
            )}
          </span>
        }
      />
      <MemberTable members={members} />
    </div>
  );
}
