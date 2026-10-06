import { canAccessAdminRoutes } from "@/lib/auth/permissions";
import { auth } from "@/lib/auth/edge";

const protectedRoutes = [
  "/reserva",
  "/calendario",
  "/reservas",
  "/admin",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isLoginPage = pathname.startsWith("/login");
  const isAuthenticated = Boolean(req.auth);

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  if (isLoginPage && isAuthenticated) {
    return Response.redirect(new URL("/calendario", req.nextUrl.origin));
  }

  if (
    pathname.startsWith("/admin") &&
    !canAccessAdminRoutes(req.auth?.user ?? null)
  ) {
    return Response.redirect(new URL("/calendario", req.nextUrl.origin));
  }

  return undefined;
});

export const config = {
  matcher: [
    "/login",
    "/reserva/:path*",
    "/calendario/:path*",
    "/reservas/:path*",
    "/admin/:path*",
  ],
};
