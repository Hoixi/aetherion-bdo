import { withAuth } from "next-auth/middleware";

/**
 * Oturum kapısı.
 *
 * Yeni tasarım `/test` altında ve buraya eklenmemişti; sayfalar yalnızca
 * istemci tarafında oturum kontrolü yapıyordu. Veri güvendeydi (API'ler
 * 401 dönüyor) ama giriş yapmamış kişi boş bir kabuk görüp ne olduğunu
 * anlamıyordu. Artık doğrudan giriş ekranına gidiyor.
 *
 * Tek istisna başvuru formu: klana katılmak isteyen kişinin henüz hesabı
 * yok, giriş isteyemeyiz.
 */
export default withAuth({
  pages: { signIn: "/" },
  callbacks: {
    authorized: ({ req, token }) =>
      req.nextUrl.pathname.startsWith("/test/basvuru") ? true : !!token,
  },
});

export const config = {
  matcher: [
    "/test/:path*",
    // Eski adresler artık next.config'de yönlendiriliyor; yönlendirme
    // kaçarsa diye kapı burada da duruyor.
    "/dashboard/:path*",
    "/wars/:path*",
    "/members/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
