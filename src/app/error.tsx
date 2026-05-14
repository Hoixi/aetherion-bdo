"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Bir hata oluştu</h1>
        <p className="text-bdo-text-muted mb-6">{error.message}</p>
        <button
          onClick={() => reset()}
          className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors"
        >
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
