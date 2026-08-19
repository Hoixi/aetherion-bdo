import type { ReactNode } from "react";

/**
 * Tema denemesi — mevcut sidebar düzeninden tamamen bağımsız.
 *
 * Ana uygulama `md:ml-56` ile sidebar'a yer açıyor; burası kendi tam
 * genişliğini kurabilsin diye sabit konumlanıp o payı devre dışı bırakıyor.
 */
export default function TestLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto z-[60]" style={{ background: "var(--t-canvas)" }}>
      {children}
    </div>
  );
}
