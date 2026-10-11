import { NextResponse, type NextRequest } from "next/server";
import { esRutaProtegida, inicioDeRol, puedeAcceder } from "@/lib/roles";
import { NOMBRE_COOKIE_SESION, verificarSesion } from "@/lib/token-sesion";

/**
 * Protección de rutas por rol (RF-01 y RF-02). En Next.js 16 el antiguo
 * `middleware.ts` se llama `proxy.ts`; cumple la misma función.
 *
 * Es una primera barrera: cada página y Server Action vuelve a verificar la
 * sesión contra la base de datos con `requerirRol`.
 */
export async function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  const sesion = await verificarSesion(request.cookies.get(NOMBRE_COOKIE_SESION)?.value);

  if (esRutaProtegida(ruta)) {
    if (!sesion) {
      const url = new URL("/iniciar-sesion", request.url);
      url.searchParams.set("siguiente", ruta);
      const respuesta = NextResponse.redirect(url);
      respuesta.cookies.delete(NOMBRE_COOKIE_SESION);
      return respuesta;
    }
    if (!puedeAcceder(sesion.rol, ruta)) {
      return NextResponse.redirect(new URL(inicioDeRol(sesion.rol), request.url));
    }
  }

  if (sesion && (ruta === "/iniciar-sesion" || ruta === "/registro")) {
    return NextResponse.redirect(new URL(inicioDeRol(sesion.rol), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
