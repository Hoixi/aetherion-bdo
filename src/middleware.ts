import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/wars/:path*", "/members/:path*", "/profile/:path*", "/admin/:path*"],
};
