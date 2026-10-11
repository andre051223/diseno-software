import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { CanalOrigen } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { esErrorUnico } from "@/lib/errores-db";
import { crearFechaBogota } from "@/lib/fechas";
import type { DatosContacto, DatosPaciente } from "@/lib/validaciones/pacientes";
import { cifrarContrasena, solicitarRecuperacion } from "./autenticacion";
import { registrarBitacora } from "./bitacora";

export type ResultadoPaciente =
  | { ok: true; pacienteId: number; usuarioId: number | null; mensaje?: string }
  | { ok: false; mensaje: string; campo?: string };

const MENSAJE_DOCUMENTO_REPETIDO =
  "Ya existe un paciente registrado con ese tipo y número de documento.";

/** RF-06: indica si ya existe un paciente con el mismo tipo y número de documento. */
export async function existeDocumento(tipoDocumento: DatosPaciente["tipoDocumento"], numeroDocumento: string) {
  const paciente = await db.paciente.findUnique({
    where: { tipoDocumento_numeroDocumento: { tipoDocumento, numeroDocumento } },
    select: { id: true },
  });
  return paciente !== null;
}

function nombreCompleto(datos: Pick<DatosPaciente, "nombres" | "apellidos">) {
  return `${datos.nombres} ${datos.apellidos}`;
}

function resumenPaciente(datos: DatosPaciente) {
  return {
    tipoDocumento: datos.tipoDocumento,
    numeroDocumento: datos.numeroDocumento,
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    fechaNacimiento: datos.fechaNacimiento,
    telefono: datos.telefono,
    correo: datos.correo,
    aseguradoraId: datos.aseguradoraId,
  };
}

async function verificarAseguradora(aseguradoraId: number) {
  const aseguradora = await db.aseguradora.findUnique({ where: { id: aseguradoraId } });
  return aseguradora?.activo ?? false;
}

/**
 * RF-05 y RF-06: registra un paciente con todos los datos solicitados.
 *
 * - Por el portal (o la aplicación) se crea la cuenta con la contraseña que el paciente eligió.
 * - En ventanilla se crea la cuenta solo si el correo no pertenece a otra cuenta (por ejemplo, el de
 *   un acudiente) y se envía un enlace de un solo uso para que el paciente cree su contraseña.
 *
 * La regla de documento único se verifica antes de escribir y, además, la garantiza el índice
 * único compuesto `(tipoDocumento, numeroDocumento)` de la base de datos.
 */
export async function registrarPaciente(
  datos: DatosPaciente,
  opciones: { canal: CanalOrigen; contrasena?: string; actorId?: number | null },
): Promise<ResultadoPaciente> {
  // RF-06: no se acepta un tipo y número de documento ya existente.
  if (await existeDocumento(datos.tipoDocumento, datos.numeroDocumento)) {
    return { ok: false, mensaje: MENSAJE_DOCUMENTO_REPETIDO, campo: "numeroDocumento" };
  }
  if (!(await verificarAseguradora(datos.aseguradoraId))) {
    return { ok: false, mensaje: "Seleccione una aseguradora válida.", campo: "aseguradoraId" };
  }

  const correoOcupado = (await db.usuario.findUnique({ where: { correo: datos.correo } })) !== null;
  const porPortal = opciones.canal === "portal_web" || opciones.canal === "aplicacion_movil";
  if (porPortal && correoOcupado) {
    return {
      ok: false,
      mensaje: "Ya existe una cuenta con ese correo. Inicie sesión o recupere su contraseña.",
      campo: "correo",
    };
  }
  const crearCuenta = porPortal || !correoOcupado;
  // En ventanilla la cuenta nace con una contraseña aleatoria que nadie conoce; el paciente crea la suya con el enlace.
  const contrasena = opciones.contrasena ?? randomBytes(24).toString("base64url");
  const hashContrasena = crearCuenta ? await cifrarContrasena(contrasena) : null;

  try {
    const resultado = await db.$transaction(async (tx) => {
      const usuario = hashContrasena
        ? await tx.usuario.create({
            data: { correo: datos.correo, nombre: nombreCompleto(datos), rol: "paciente", hashContrasena },
          })
        : null;

      const paciente = await tx.paciente.create({
        data: {
          tipoDocumento: datos.tipoDocumento,
          numeroDocumento: datos.numeroDocumento,
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          fechaNacimiento: crearFechaBogota(datos.fechaNacimiento),
          telefono: datos.telefono,
          correo: datos.correo,
          aseguradoraId: datos.aseguradoraId,
          usuarioId: usuario?.id ?? null,
        },
      });

      await registrarBitacora(
        {
          usuarioId: opciones.actorId ?? usuario?.id ?? null,
          entidad: "Paciente",
          entidadId: paciente.id,
          accion: "registrar_paciente",
          estadoNuevo: { ...resumenPaciente(datos), canal: opciones.canal, conCuenta: Boolean(usuario) },
        },
        tx,
      );
      return { pacienteId: paciente.id, usuarioId: usuario?.id ?? null };
    });

    let mensaje: string | undefined;
    if (!porPortal) {
      if (resultado.usuarioId) {
        await solicitarRecuperacion(datos.correo, new Date(), "activacion");
        mensaje = "Enviamos al correo del paciente un enlace para que cree la contraseña de su cuenta en el portal.";
      } else {
        mensaje =
          "El correo ya pertenece a otra cuenta del portal, por eso el paciente quedó registrado sin acceso propio. Puede agendar sus citas en ventanilla o por teléfono.";
      }
    }
    return { ok: true, ...resultado, mensaje };
  } catch (error) {
    // RF-06, segunda capa: si dos registros simultáneos pasan la verificación, el índice único rechaza uno.
    if (esErrorUnico(error)) {
      return { ok: false, mensaje: MENSAJE_DOCUMENTO_REPETIDO, campo: "numeroDocumento" };
    }
    throw error;
  }
}

/**
 * RF-07: actualiza el teléfono y el correo de contacto y deja el cambio en la bitácora
 * con el usuario que lo hizo, la fecha y la hora, y los valores anterior y nuevo.
 * Si el paciente tiene cuenta, el correo de contacto también es el de inicio de sesión.
 */
export async function actualizarContacto(
  pacienteId: number,
  datos: DatosContacto,
  actorId: number,
): Promise<{ ok: true; sinCambios?: boolean } | { ok: false; mensaje: string; campo?: string }> {
  const anterior = await db.paciente.findUnique({ where: { id: pacienteId } });
  if (!anterior) return { ok: false, mensaje: "El paciente no existe." };

  if (anterior.telefono === datos.telefono && anterior.correo === datos.correo) {
    return { ok: true, sinCambios: true };
  }

  if (anterior.usuarioId && datos.correo !== anterior.correo) {
    const otraCuenta = await db.usuario.findUnique({ where: { correo: datos.correo } });
    if (otraCuenta && otraCuenta.id !== anterior.usuarioId) {
      return { ok: false, mensaje: "Ese correo ya está registrado en otra cuenta.", campo: "correo" };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.paciente.update({
      where: { id: pacienteId },
      data: { telefono: datos.telefono, correo: datos.correo },
    });
    if (anterior.usuarioId && datos.correo !== anterior.correo) {
      await tx.usuario.update({ where: { id: anterior.usuarioId }, data: { correo: datos.correo } });
    }
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Paciente",
        entidadId: pacienteId,
        accion: "actualizar_contacto",
        estadoAnterior: { telefono: anterior.telefono, correo: anterior.correo },
        estadoNuevo: { telefono: datos.telefono, correo: datos.correo },
      },
      tx,
    );
  });

  return { ok: true };
}

export type CambioContacto = {
  id: number;
  fecha: Date;
  usuario: string;
  anterior: { telefono?: string; correo?: string };
  nuevo: { telefono?: string; correo?: string };
};

function leerJson(valor: string | null): { telefono?: string; correo?: string } {
  if (!valor) return {};
  try {
    return JSON.parse(valor);
  } catch {
    return {};
  }
}

/** RF-07: historial de cambios de contacto del paciente, del más reciente al más antiguo. */
export async function historialContacto(pacienteId: number): Promise<CambioContacto[]> {
  const registros = await db.bitacora.findMany({
    where: { entidad: "Paciente", entidadId: String(pacienteId), accion: "actualizar_contacto" },
    include: { usuario: { select: { nombre: true } } },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: 20,
  });
  return registros.map((registro) => ({
    id: registro.id,
    fecha: registro.fecha,
    usuario: registro.usuario?.nombre ?? "Sistema",
    anterior: leerJson(registro.estadoAnterior),
    nuevo: leerJson(registro.estadoNuevo),
  }));
}

/** Búsqueda por número de documento (exacto o parcial), nombres o apellidos. */
export function filtroBusquedaPacientes(texto: string): Prisma.PacienteWhereInput {
  if (!texto) return {};
  const palabras = texto.split(/\s+/).filter(Boolean);
  return {
    OR: [
      { numeroDocumento: { contains: texto.replace(/[.\s]/g, "").toUpperCase() } },
      // Cada palabra debe aparecer en los nombres o en los apellidos.
      { AND: palabras.map((palabra) => ({ OR: [{ nombres: { contains: palabra } }, { apellidos: { contains: palabra } }] })) },
    ],
  };
}
