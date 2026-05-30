"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <img src="/icons/logo.png" alt="Aetherion" className="w-36 h-36 mx-auto mb-4 drop-shadow-lg" />
        <h1 className="text-4xl font-bold text-bdo-gold mb-2">AETHERION</h1>
        <p className="text-bdo-text-muted mb-8">Guild Management</p>
        <button
          onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
          className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-3 rounded-lg hover:bg-bdo-gold-dim transition-colors"
        >
          Discord ile Giriş
        </button>
      </div>
    </div>
  );
}
