import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_COOKIE_SESION } from "@/lib/token-sesion";

/**
 * Elimina la cookie de sesión y vuelve al inicio de sesión. Se usa cuando el token
 * es válido pero la cuenta fue inactivada o cambió de rol, para evitar redirecciones en bucle.
 */
export function GET(request: NextRequest) {
  const respuesta = NextResponse.redirect(new URL("/iniciar-sesion", request.url));
  respuesta.cookies.delete(NOMBRE_COOKIE_SESION);
  return respuesta;
}
