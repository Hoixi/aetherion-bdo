import Link from "next/link";
import { ShieldAlert, ArrowLeft, UserPlus } from "lucide-react";

export default function DeniedPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bdo-bg px-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-6 h-6 text-red-400" strokeWidth={1.75} />
        </div>

        <h1 className="text-xl font-bold text-bdo-text-primary mb-2">Erişim Reddedildi</h1>
        <p className="text-[13px] text-bdo-text-muted leading-relaxed mb-6">
          Bu siteye erişebilmek için Aetherion Discord sunucusunda üye olman ve gerekli role sahip olman gerekiyor.
        </p>

        <Link
          href="/basvuru"
          className="inline-flex items-center gap-2 bg-gradient-to-b from-[#e0b040] to-[#c29328] text-bdo-bg font-semibold px-4 py-2 rounded-lg text-[13px] hover:from-[#e8bb4d] hover:to-[#cc9c2c] transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
          Klana Başvur
        </Link>

        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] text-bdo-text-secondary hover:text-bdo-gold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}
