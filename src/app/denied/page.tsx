import Link from "next/link";

export default function DeniedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Erişim Reddedildi</h1>
        <p className="text-bdo-text-muted mb-6">Bu siteye erişim yetkiniz yok.</p>
        <Link href="/" className="text-bdo-gold hover:underline">
          Giriş sayfasına dön
        </Link>
      </div>
    </div>
  );
}
