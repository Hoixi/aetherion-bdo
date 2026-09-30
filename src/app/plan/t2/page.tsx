import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TestShell } from "@/components/app-shell";
import { t2PlanVerisi } from "@/lib/t2-plan";
import { PlanIcerik } from "./plan-icerik";

export const dynamic = "force-dynamic";

/**
 * T2 savaş planı — menüde yok, adresi bilen ve giriş yapan görür.
 *
 * Çizim `plan-icerik.tsx`te: sayfa yalnızca oturumu kontrol edip veriyi
 * çekiyor. Ayrı durmasının sebebi, içeriği veriyle birlikte oturum
 * olmadan da (yerel önizleme) çizebilmek.
 */
export default async function T2PlanSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <TestShell title="T2 Planı" subtitle="Giriş gerekiyor.">
        <div className="p-6 text-[13px] rounded-[var(--t-r)]"
             style={{ color: "var(--t-dim)", background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
          Bu sayfa klan içidir; Discord ile giriş yap.
        </div>
      </TestShell>
    );
  }
  const v = await t2PlanVerisi();
  return <PlanIcerik v={v} />;
}
