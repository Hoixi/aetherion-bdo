import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TestShell } from "@/components/app-shell";
import { rakipDosyalari } from "@/lib/rakip-dosyasi";
import { RakipIcerik } from "./icerik";

export const dynamic = "force-dynamic";

/**
 * Rakip dosyaları — menüde yok, adresi bilen ve giriş yapan görür.
 *
 * Çizim `icerik.tsx`te; burada yalnız oturum ve veri (bkz. plan/t2).
 */
export default async function RakiplerSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <TestShell title="Rakip dosyaları" subtitle="Giriş gerekiyor.">
        <div className="p-6 text-[13px] rounded-[var(--t-r)]"
             style={{ color: "var(--t-dim)", background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
          Bu sayfa klan içidir; Discord ile giriş yap.
        </div>
      </TestShell>
    );
  }
  const v = await rakipDosyalari();
  return <RakipIcerik {...v} />;
}
