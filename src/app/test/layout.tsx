import type { ReactNode } from "react";

/**
 * Tema denemesi — mevcut sidebar düzeninden tamamen bağımsız.
 *
 * Ana uygulama `md:ml-56` ile sidebar'a yer açıyor; burası kendi tam
 * genişliğini kurabilsin diye sabit konumlanıp o payı devre dışı bırakıyor.
 *
 * Zemin düz siyah veriliyor: `--t-canvas` içerideki `.t-root` üzerinde
 * tanımlı, bu eleman ona erişemiyor. Boş bırakılınca altta globals.css'in
 * eski lacivert gövdesi kalıyordu.
 */
export default function TestLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto z-[60]" style={{ background: "#000" }}>
      {children}
    </div>
  );
}
