import { withAuth } from "next-auth/middleware";

/**
 * Oturum kapısı.
 *
 * Giriş yapmamış kişi doğrudan giriş ekranına gidiyor; `callbackUrl` ile
 * gitmek istediği sayfaya sonradan dönüyor.
 *
 * Tek istisna başvuru formu: klana katılmak isteyen kişinin henüz hesabı
 * yok, giriş isteyemeyiz.
 */
export default withAuth({
  pages: { signIn: "/" },
  callbacks: {
    authorized: ({ req, token }) =>
      req.nextUrl.pathname.startsWith("/basvuru") ? true : !!token,
  },
});

export const config = {
  matcher: [
    "/panel/:path*",
    "/savaslar/:path*",
    "/uyeler/:path*",
    "/profil/:path*",
    "/takvim/:path*",
    "/etkinlikler/:path*",
    "/forum/:path*",
    "/kaleler/:path*",
    "/harita/:path*",
    "/geo/:path*",
    "/analiz/:path*",
    "/hasar-raporu/:path*",
    "/tier-list/:path*",
    "/patch-notes/:path*",
    "/grind-tracker/:path*",
    "/ai-asistan/:path*",
    "/optimizer/:path*",
    "/ally/:path*",
    "/esyalar/:path*",
    "/admin/:path*",
  ],
};
