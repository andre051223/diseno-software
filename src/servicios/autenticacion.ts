import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Rol } from "@/generated/prisma/enums";
import { configuracion } from "@/lib/configuracion";
import { db } from "@/lib/db";
import { formatearFechaHora, formatearHora } from "@/lib/fechas";
import { registrarBitacora } from "./bitacora";
import { registrarNotificacion, urlAplicacion } from "./notificaciones";

const MENSAJE_CREDENCIALES = "El correo o la contraseña no son correctos.";
const COSTO_HASH = 10;
// Hash de referencia para igualar el tiempo de respuesta cuando la cuenta no existe.
const HASH_FICTICIO = bcrypt.hashSync("contrasena-ficticia", COSTO_HASH);

export async function cifrarContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, COSTO_HASH);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type ResultadoInicioSesion =
  | { ok: true; usuario: { id: number; nombre: string; rol: Rol } }
  | { ok: false; mensaje: string };

/**
 * RF-01: valida correo y contraseña contra cuentas activas.
 * RF-03: tras tres intentos fallidos consecutivos bloquea la cuenta 15 minutos
 * y envía un aviso al correo del titular.
 */
export async function validarCredenciales(
  correo: string,
  contrasena: string,
  ahora: Date = new Date(),
): Promise<ResultadoInicioSesion> {
  const usuario = await db.usuario.findUnique({ where: { correo: correo.trim().toLowerCase() } });

  if (!usuario || !usuario.activo) {
    await bcrypt.compare(contrasena, HASH_FICTICIO);
    return { ok: false, mensaje: MENSAJE_CREDENCIALES };
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
    return {
      ok: false,
      mensaje: `La cuenta está bloqueada por seguridad hasta las ${formatearHora(usuario.bloqueadoHasta)}. Intente de nuevo más tarde.`,
    };
  }

  const coincide = await bcrypt.compare(contrasena, usuario.hashContrasena);

  if (!coincide) {
    const intentos = usuario.intentosFallidos + 1;

    if (intentos >= configuracion.intentosFallidosAntesDeBloqueo) {
      const bloqueadoHasta = new Date(ahora.getTime() + configuracion.minutosBloqueoCuenta * 60_000);
      await db.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta },
      });
      // RF-03: aviso al correo del titular de la cuenta.
      await registrarNotificacion(
        {
          destinatario: usuario.correo,
          canal: "correo",
          tipo: "bloqueo_cuenta",
          asunto: "Su cuenta fue bloqueada temporalmente",
          contenido:
            `Hola, ${usuario.nombre}. Registramos ${configuracion.intentosFallidosAntesDeBloqueo} intentos fallidos ` +
            `de inicio de sesión en su cuenta. Por seguridad, la cuenta quedó bloqueada hasta el ` +
            `${formatearFechaHora(bloqueadoHasta)}. Si no fue usted, comuníquese con el hospital.`,
          usuarioId: usuario.id,
        },
        db,
        ahora,
      );
      await registrarBitacora({
        usuarioId: usuario.id,
        entidad: "Usuario",
        entidadId: usuario.id,
        accion: "bloqueo_por_intentos",
        estadoAnterior: { bloqueadoHasta: null },
        estadoNuevo: { bloqueadoHasta: bloqueadoHasta.toISOString() },
      });
      return {
        ok: false,
        mensaje: `Superó el número de intentos permitidos. La cuenta quedó bloqueada durante ${configuracion.minutosBloqueoCuenta} minutos y enviamos un aviso a su correo.`,
      };
    }

    await db.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: intentos, bloqueadoHasta: null },
    });
    return { ok: false, mensaje: MENSAJE_CREDENCIALES };
  }

  if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
    await db.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
  }

  return { ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } };
}

/**
 * RF-04: genera un enlace de un solo uso con vigencia de 30 minutos y lo deja en
 * la bandeja de salida. La respuesta al usuario es la misma exista o no la cuenta.
 *
 * Con `motivo: "activacion"` se usa el mismo mecanismo para que un paciente
 * registrado en ventanilla (RF-05) cree su contraseña del portal.
 */
export async function solicitarRecuperacion(
  correo: string,
  ahora: Date = new Date(),
  motivo: "recuperacion" | "activacion" = "recuperacion",
) {
  const usuario = await db.usuario.findUnique({
    where: { correo: correo.trim().toLowerCase() },
  });
  if (!usuario || !usuario.activo || usuario.rol !== "paciente") return;

  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(ahora.getTime() + configuracion.minutosVigenciaRecuperacion * 60_000);

  await db.$transaction(async (tx) => {
    // Un enlace nuevo invalida los anteriores que no se hayan usado.
    await tx.tokenRecuperacion.updateMany({
      where: { usuarioId: usuario.id, usadoEn: null },
      data: { usadoEn: ahora },
    });
    await tx.tokenRecuperacion.create({
      data: { usuarioId: usuario.id, tokenHash: hashToken(token), expiraEn },
    });
    const enlace = `${urlAplicacion()}/restablecer-contrasena/${token}`;
    const vigencia = `puede usarse una sola vez y vence el ${formatearFechaHora(expiraEn)}.`;
    await registrarNotificacion(
      motivo === "activacion"
        ? {
            destinatario: usuario.correo,
            canal: "correo",
            tipo: "activacion_cuenta",
            asunto: "Active su acceso al portal de citas",
            contenido:
              `Hola, ${usuario.nombre}. Quedó registrado en el Hospital Central San Rafael. ` +
              `Para crear la contraseña de su cuenta en el portal de citas abra este enlace: ${enlace} — ${vigencia} ` +
              `Si vence, use la opción «¿Olvidó su contraseña?» del portal.`,
            usuarioId: usuario.id,
          }
        : {
            destinatario: usuario.correo,
            canal: "correo",
            tipo: "recuperacion_contrasena",
            asunto: "Recuperación de contraseña",
            contenido:
              `Hola, ${usuario.nombre}. Para crear una nueva contraseña abra este enlace: ${enlace} — ` +
              `${vigencia} Si usted no lo solicitó, ignore este mensaje.`,
            usuarioId: usuario.id,
          },
      tx,
      ahora,
    );
  });

  return token;
}

/** RF-04: verifica que el enlace exista, no se haya usado y siga vigente. */
export async function verificarTokenRecuperacion(token: string, ahora: Date = new Date()) {
  const registro = await db.tokenRecuperacion.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!registro || registro.usadoEn || registro.expiraEn <= ahora) return null;
  return registro;
}

/** RF-04: cambia la contraseña y marca el enlace como usado. */
export async function restablecerContrasena(
  token: string,
  nuevaContrasena: string,
  ahora: Date = new Date(),
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const hash = await cifrarContrasena(nuevaContrasena);

  return db.$transaction(async (tx) => {
    // La marca de uso es condicional: si dos solicitudes llegan a la vez, solo una gana.
    const marcado = await tx.tokenRecuperacion.updateMany({
      where: { tokenHash: hashToken(token), usadoEn: null, expiraEn: { gt: ahora } },
      data: { usadoEn: ahora },
    });
    if (marcado.count !== 1) {
      return {
        ok: false as const,
        mensaje: "El enlace no es válido, ya fue usado o venció. Solicite uno nuevo.",
      };
    }
    const registro = await tx.tokenRecuperacion.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    await tx.usuario.update({
      where: { id: registro.usuarioId },
      data: { hashContrasena: hash, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await registrarBitacora(
      {
        usuarioId: registro.usuarioId,
        entidad: "Usuario",
        entidadId: registro.usuarioId,
        accion: "restablecer_contrasena",
      },
      tx,
    );
    return { ok: true as const };
  });
}
