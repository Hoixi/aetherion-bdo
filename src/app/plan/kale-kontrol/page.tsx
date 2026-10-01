import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TestShell } from "@/components/app-shell";
import { KaleKontrol } from "./icerik";

export const dynamic = "force-dynamic";

/**
 * Kale konumu kontrol ekranı — menüde yok, yalnız savaş yöneticisi görür.
 *
 * Kale konumları üç kaynaktan geliyor (oyun çapası, elle düzeltme,
 * garmoth türetmesi) ve hangisinin doğru olduğu ancak oyuna bakınca
 * anlaşılıyor. Bu sayfa üçünü aynı haritada yan yana koyuyor; bölge
 * bölge açıp kapatıp tek tek karşılaştırmak için.
 */
export default async function KaleKontrolSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.canManageWars) {
    return (
      <TestShell title="Kale kontrol" subtitle="Yetki gerekiyor.">
        <div className="p-6 text-[13px] rounded-[var(--t-r)]"
             style={{ color: "var(--t-dim)", background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
          Bu ekran savaş yöneticilerine açık.
        </div>
      </TestShell>
    );
  }
  return <KaleKontrol />;
}
