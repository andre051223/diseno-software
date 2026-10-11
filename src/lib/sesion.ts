import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Rol } from "@/generated/prisma/enums";
import { configuracion } from "./configuracion";
import { db } from "./db";
import { inicioDeRol } from "./roles";
import {
  NOMBRE_COOKIE_SESION,
  firmarSesion,
  verificarSesion,
  type DatosSesion,
} from "./token-sesion";

/** Abre la sesión guardando el token firmado en una cookie httpOnly (RF-01). */
export async function crearSesion(datos: DatosSesion) {
  const token = await firmarSesion(datos);
  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: configuracion.horasDuracionSesion * 60 * 60,
  });
}

export async function cerrarSesion() {
  const almacen = await cookies();
  almacen.delete(NOMBRE_COOKIE_SESION);
}

export type UsuarioActual = {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  pacienteId: number | null;
  medicoId: number | null;
};

/**
 * Capa de acceso a datos: lee la cookie, verifica la firma y confirma en la base
 * de datos que la cuenta siga activa. Devuelve null si no hay sesión válida.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const almacen = await cookies();
  const sesion = await verificarSesion(almacen.get(NOMBRE_COOKIE_SESION)?.value);
  if (!sesion) return null;

  const usuario = await db.usuario.findUnique({
    where: { id: sesion.usuarioId },
    include: { paciente: { select: { id: true } }, medico: { select: { id: true } } },
  });
  if (!usuario || !usuario.activo || usuario.rol !== sesion.rol) return null;

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    pacienteId: usuario.paciente?.id ?? null,
    medicoId: usuario.medico?.id ?? null,
  };
});

/**
 * Exige una sesión con alguno de los roles indicados. Se usa en páginas y en
 * Server Actions para no depender solo del proxy.
 */
export async function requerirRol(...roles: Rol[]): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/api/sesion/cerrar");
  if (roles.length > 0 && !roles.includes(usuario.rol)) redirect(inicioDeRol(usuario.rol));
  return usuario;
}
