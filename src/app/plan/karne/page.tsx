import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TestShell } from "@/components/app-shell";
import { karneler } from "@/lib/karne";
import { KarneIcerik } from "./icerik";

export const dynamic = "force-dynamic";

/** Kişisel savaş karnesi — menüde yok, adresi bilen ve giriş yapan görür. */
export default async function KarneSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <TestShell title="Savaş karnesi" subtitle="Giriş gerekiyor.">
        <div className="p-6 text-[13px] rounded-[var(--t-r)]"
             style={{ color: "var(--t-dim)", background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
          Bu sayfa klan içidir; Discord ile giriş yap.
        </div>
      </TestShell>
    );
  }
  const v = await karneler();
  return <KarneIcerik {...v} />;
}
