import { SignJWT, jwtVerify } from "jose";
import type { Rol } from "@/generated/prisma/enums";
import { configuracion } from "./configuracion";

/** Nombre de la cookie httpOnly que guarda la sesión. */
export const NOMBRE_COOKIE_SESION = "hsr_sesion";

export type DatosSesion = {
  usuarioId: number;
  rol: Rol;
  nombre: string;
};

const SECRETO_DESARROLLO = "secreto-solo-para-desarrollo-local-hospital-san-rafael";

/** Clave HS256 de la aplicación; la usan la sesión y el comprobante de cobertura (RF-21). */
export function obtenerClave(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Falta la variable SESSION_SECRET (mínimo 32 caracteres).");
    }
    return new TextEncoder().encode(SECRETO_DESARROLLO);
  }
  return new TextEncoder().encode(secreto);
}

/** Firma el contenido de la sesión con HS256. */
export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ rol: datos.rol, nombre: datos.nombre })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(datos.usuarioId))
    .setIssuedAt()
    .setExpirationTime(`${configuracion.horasDuracionSesion}h`)
    .sign(obtenerClave());
}

/** Verifica la firma y la vigencia; devuelve null si el token no es válido. */
export async function verificarSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, obtenerClave(), { algorithms: ["HS256"] });
    const usuarioId = Number(payload.sub);
    if (!Number.isInteger(usuarioId) || typeof payload.rol !== "string") return null;
    return {
      usuarioId,
      rol: payload.rol as Rol,
      nombre: typeof payload.nombre === "string" ? payload.nombre : "",
    };
  } catch {
    return null;
  }
}
