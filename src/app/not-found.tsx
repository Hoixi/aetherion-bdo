import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-bdo-gold mb-4">404</h1>
        <p className="text-bdo-text-muted mb-6">Sayfa bulunamadı.</p>
        <Link href="/" className="text-bdo-gold hover:underline">
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
