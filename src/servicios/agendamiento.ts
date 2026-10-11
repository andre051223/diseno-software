import type { CanalOrigen, EstadoCita, ResultadoCobertura, Rol } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { generarCodigoCita, generarTokenRespuesta } from "@/lib/codigos";
import { configuracion } from "@/lib/configuracion";
import { db, type TransaccionDb } from "@/lib/db";
import { esErrorUnico } from "@/lib/errores-db";
import { estadosCitaActiva } from "@/lib/etiquetas";
import { crearFechaBogota } from "@/lib/fechas";
import { sumarDiasIso } from "./generador-espacios";
import { registrarBitacora } from "./bitacora";
import { notificarCita, type EventoCita } from "./mensajes-cita";

export type ResultadoAgenda<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string; codigo?: CodigoError };

export type CodigoError = "no-disponible" | "cita-activa" | "no-cancelable" | "requiere-recepcion" | "no-encontrada";

/** Error de negocio que interrumpe (y revierte) una transacción. */
class ErrorAgenda extends Error {
  constructor(
    mensaje: string,
    readonly codigo: CodigoError,
  ) {
    super(mensaje);
  }
}

const MENSAJE_NO_DISPONIBLE = "El horario elegido ya no está disponible. Por favor, elija otro.";

/** Estados en los que la cita todavía se puede reprogramar o cancelar (antes de llegar al hospital). */
export const estadosModificables: EstadoCita[] = ["agendada", "confirmada", "pendiente_validacion"];

/** RF-19: canal de origen según el rol de quien agenda. */
export function canalSegunRol(rol: Rol): CanalOrigen {
  if (rol === "recepcionista") return "ventanilla";
  if (rol === "agente_telefonico") return "telefono";
  return "portal_web";
}

/**
 * RF-14: condición que hace a un espacio tomable por un usuario: está libre, su reserva
 * temporal ya venció (se libera automáticamente al vencer) o la reserva es de ese usuario.
 */
function filtroEspacioTomable(usuarioId: number, ahora: Date): Prisma.EspacioWhereInput {
  return {
    OR: [
      { estado: "libre" },
      { estado: "reservado_temporal", reservadoHasta: { lt: ahora } },
      { estado: "reservado_temporal", reservadoPorId: usuarioId },
    ],
  };
}

/** Espacio válido para la especialidad: médico, consultorio y especialidad activos y en el futuro. */
function filtroEspacioValido(especialidadId: number, ahora: Date): Prisma.EspacioWhereInput {
  return {
    inicio: { gt: ahora },
    medico: { activo: true, especialidades: { some: { id: especialidadId, activo: true } } },
    consultorio: { activo: true },
  };
}

/** Estado al que vuelve un espacio que se libera: si cae en una novedad del médico sigue bloqueado. */
function estadoAlLiberar(espacio: { novedadId: number | null }) {
  return espacio.novedadId ? ("bloqueado" as const) : ("libre" as const);
}

function resumenEspacio(espacio: { id: number; inicio: Date; medicoId: number; consultorioId: number }) {
  return {
    espacioId: espacio.id,
    inicio: espacio.inicio.toISOString(),
    medicoId: espacio.medicoId,
    consultorioId: espacio.consultorioId,
  };
}

// ---------------------------------------------------------------------------
// RF-12: búsqueda de espacios libres
// ---------------------------------------------------------------------------

export const maximoEspaciosListados = 120;

/**
 * RF-12: espacios libres filtrados por especialidad, médico (opcional) y rango de fechas
 * (días de Bogotá, ambos incluidos). Solo ofrece espacios futuros de médicos, consultorios
 * y especialidades activos. RF-14: los espacios con reserva temporal de otra persona no se
 * muestran mientras la reserva esté vigente.
 */
export async function buscarEspaciosLibres(
  filtro: { especialidadId: number; medicoId?: number; desde: string; hasta: string; excluirEspacioId?: number },
  usuarioId: number,
  ahora: Date = new Date(),
) {
  const desde = crearFechaBogota(filtro.desde, "00:00");
  const hasta = crearFechaBogota(sumarDiasIso(filtro.hasta, 1), "00:00");
  const where: Prisma.EspacioWhereInput = {
    AND: [
      filtroEspacioValido(filtro.especialidadId, ahora),
      filtroEspacioTomable(usuarioId, ahora),
      { inicio: { gte: desde, lt: hasta } },
      filtro.medicoId ? { medicoId: filtro.medicoId } : {},
      filtro.excluirEspacioId ? { id: { not: filtro.excluirEspacioId } } : {},
    ],
  };
  const [total, espacios] = await Promise.all([
    db.espacio.count({ where }),
    db.espacio.findMany({
      where,
      include: { medico: true, consultorio: true },
      orderBy: [{ inicio: "asc" }, { medicoId: "asc" }],
      take: maximoEspaciosListados,
    }),
  ]);
  return { total, espacios };
}

// ---------------------------------------------------------------------------
// RF-14: reserva temporal
// ---------------------------------------------------------------------------

/**
 * RF-14: bloquea el espacio a los demás durante cinco minutos mientras el usuario completa
 * la reserva. La actualización es condicional (solo si el espacio sigue tomable), así que
 * de dos solicitudes simultáneas solo una obtiene la reserva. Las reservas anteriores del
 * mismo usuario se liberan para que nadie acapare varios horarios.
 */
export async function reservarEspacio(
  espacioId: number,
  especialidadId: number,
  usuarioId: number,
  ahora: Date = new Date(),
): Promise<ResultadoAgenda<{ reservadoHasta: Date }>> {
  const reservadoHasta = new Date(ahora.getTime() + configuracion.minutosReservaTemporal * 60_000);
  return db.$transaction(async (tx) => {
    const reservado = await tx.espacio.updateMany({
      where: {
        AND: [{ id: espacioId }, filtroEspacioValido(especialidadId, ahora), filtroEspacioTomable(usuarioId, ahora)],
      },
      data: { estado: "reservado_temporal", reservadoHasta, reservadoPorId: usuarioId },
    });
    if (reservado.count !== 1) return { ok: false as const, mensaje: MENSAJE_NO_DISPONIBLE, codigo: "no-disponible" as const };

    await tx.espacio.updateMany({
      where: { reservadoPorId: usuarioId, estado: "reservado_temporal", id: { not: espacioId } },
      data: { estado: "libre", reservadoHasta: null, reservadoPorId: null },
    });
    return { ok: true as const, reservadoHasta };
  });
}

/** RF-14: el usuario abandona la reserva (por ejemplo, para elegir otro horario). */
export async function liberarReserva(espacioId: number, usuarioId: number) {
  const liberado = await db.espacio.updateMany({
    where: { id: espacioId, estado: "reservado_temporal", reservadoPorId: usuarioId },
    data: { estado: "libre", reservadoHasta: null, reservadoPorId: null },
  });
  return liberado.count === 1;
}

/** RF-14: libera las reservas temporales vencidas; lo usa la tarea programada. */
export async function liberarReservasVencidas(ahora: Date = new Date()) {
  const liberadas = await db.espacio.updateMany({
    where: { estado: "reservado_temporal", reservadoHasta: { lt: ahora } },
    data: { estado: "libre", reservadoHasta: null, reservadoPorId: null },
  });
  return liberadas.count;
}

/** RF-14: reserva vigente del usuario sobre el espacio, con sus datos para mostrar. */
export async function obtenerReservaVigente(espacioId: number, usuarioId: number, ahora: Date = new Date()) {
  return db.espacio.findFirst({
    where: { id: espacioId, estado: "reservado_temporal", reservadoPorId: usuarioId, reservadoHasta: { gt: ahora } },
    include: { medico: true, consultorio: true },
  });
}

// ---------------------------------------------------------------------------
// RF-13, RF-15, RF-18 a RF-22: creación de la cita
// ---------------------------------------------------------------------------

export type DatosNuevaCita = {
  pacienteId: number;
  espacioId: number;
  especialidadId: number;
  canal: CanalOrigen;
  creadaPorId: number;
  resultadoCobertura: ResultadoCobertura;
  detalleCobertura: string;
  /** RF-22: el paciente decidió agendar como particular. */
  esParticular: boolean;
};

/** RF-18: cita activa del paciente en la especialidad, si la tiene. */
export async function citaActivaEnEspecialidad(
  pacienteId: number,
  especialidadId: number,
  cliente: TransaccionDb | typeof db = db,
) {
  return cliente.cita.findFirst({
    where: { pacienteId, especialidadId, estado: { in: estadosCitaActiva } },
    include: { espacio: true },
  });
}

/**
 * Crea la cita en una sola transacción:
 * - RF-18: rechaza una segunda cita activa del paciente en la misma especialidad.
 * - RF-13 (capa lógica): toma el espacio solo si sigue libre o reservado por quien agenda.
 * - RF-13 (capa de datos): `espacioActivoId` es único, así que dos citas activas nunca
 *   comparten espacio; y cada espacio es único por médico y por consultorio a esa hora.
 * - RF-15: genera un código único legible.
 * - RF-19: guarda el canal de origen y el usuario que creó la cita.
 * - RF-20: deja la creación en la bitácora.
 * - RF-21 a RF-23: guarda el resultado de la aseguradora; sin respuesta queda pendiente de validación.
 * - RF-24: deja en la bandeja de salida el correo y el SMS de confirmación.
 */
export async function crearCita(
  datos: DatosNuevaCita,
  ahora: Date = new Date(),
): Promise<ResultadoAgenda<{ citaId: number; codigo: string; estado: EstadoCita }>> {
  if (datos.resultadoCobertura !== "cubierta" && datos.resultadoCobertura !== "sin_respuesta" && !datos.esParticular) {
    return { ok: false, mensaje: "Sin cobertura de la aseguradora, la cita solo se puede agendar como particular." };
  }
  const estado: EstadoCita = datos.resultadoCobertura === "sin_respuesta" ? "pendiente_validacion" : "agendada";

  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigoCita();
    try {
      const cita = await db.$transaction(async (tx) => {
        // RF-18: no se acepta una segunda cita activa del mismo paciente en la misma especialidad.
        if (await citaActivaEnEspecialidad(datos.pacienteId, datos.especialidadId, tx)) {
          throw new ErrorAgenda(
            "El paciente ya tiene una cita activa en esta especialidad. Puede reprogramarla o cancelarla.",
            "cita-activa",
          );
        }

        // RF-13: el espacio pasa a ocupado solo si nadie más lo tomó.
        const tomado = await tx.espacio.updateMany({
          where: {
            AND: [
              { id: datos.espacioId },
              filtroEspacioValido(datos.especialidadId, ahora),
              filtroEspacioTomable(datos.creadaPorId, ahora),
            ],
          },
          data: { estado: "ocupado", reservadoHasta: null, reservadoPorId: null },
        });
        if (tomado.count !== 1) throw new ErrorAgenda(MENSAJE_NO_DISPONIBLE, "no-disponible");

        const espacio = await tx.espacio.findUniqueOrThrow({ where: { id: datos.espacioId } });
        const detalle = datos.esParticular
          ? `${datos.detalleCobertura} El paciente decidió agendar como particular.`
          : datos.detalleCobertura;
        const creada = await tx.cita.create({
          data: {
            codigo,
            pacienteId: datos.pacienteId,
            espacioId: espacio.id,
            espacioActivoId: espacio.id,
            especialidadId: datos.especialidadId,
            estado,
            canal: datos.canal,
            creadaPorId: datos.creadaPorId,
            fechaSolicitud: ahora,
            resultadoCobertura: datos.resultadoCobertura,
            detalleCobertura: detalle,
            esParticular: datos.esParticular,
            intentosCobertura: 1,
            tokenRespuesta: generarTokenRespuesta(),
          },
        });

        // RF-20: creación en la bitácora con el estado nuevo.
        await registrarBitacora(
          {
            usuarioId: datos.creadaPorId,
            entidad: "Cita",
            entidadId: creada.id,
            accion: "crear_cita",
            estadoAnterior: null,
            estadoNuevo: {
              codigo,
              estado,
              pacienteId: datos.pacienteId,
              especialidadId: datos.especialidadId,
              canal: datos.canal,
              ...resumenEspacio(espacio),
              resultadoCobertura: datos.resultadoCobertura,
              esParticular: datos.esParticular,
            },
          },
          tx,
        );
        // RF-24: correo y SMS con los datos de la cita agendada.
        await notificarCita(tx, creada.id, "agendada", {}, ahora);
        return creada;
      });
      return { ok: true, citaId: cita.id, codigo: cita.codigo, estado: cita.estado };
    } catch (error) {
      if (error instanceof ErrorAgenda) return { ok: false, mensaje: error.message, codigo: error.codigo };
      if (esErrorUnico(error)) {
        // Si el código ya existía se genera otro; si no, el índice único del espacio rechazó la doble reserva.
        if (await db.cita.findUnique({ where: { codigo }, select: { id: true } })) continue;
        return { ok: false, mensaje: MENSAJE_NO_DISPONIBLE, codigo: "no-disponible" };
      }
      throw error;
    }
  }
  throw new Error("No fue posible generar un código único para la cita.");
}

/** RF-22: deja en la bitácora la decisión sobre agendar como particular. */
export async function registrarDecisionParticular(
  datos: { usuarioId: number; pacienteId: number; especialidadId: number; espacioId: number; resultado: ResultadoCobertura; acepta: boolean },
) {
  await registrarBitacora({
    usuarioId: datos.usuarioId,
    entidad: "Cita",
    accion: datos.acepta ? "acepta_particular" : "rechaza_particular",
    estadoAnterior: { resultadoCobertura: datos.resultado },
    estadoNuevo: {
      decision: datos.acepta ? "Agendar como particular" : "No agendar como particular",
      pacienteId: datos.pacienteId,
      especialidadId: datos.especialidadId,
      espacioId: datos.espacioId,
    },
  });
}

/**
 * RF-22: una cita que quedó pendiente y luego la aseguradora rechazó (sin vigencia o sin
 * cobertura) se mantiene como particular si el paciente lo decide.
 */
export async function aceptarParticularCita(citaId: number, actorId: number): Promise<ResultadoAgenda> {
  const cita = await db.cita.findUnique({ where: { id: citaId } });
  if (!cita) return { ok: false, mensaje: "La cita no existe.", codigo: "no-encontrada" };
  const actualizada = await db.cita.updateMany({
    where: {
      id: citaId,
      estado: "pendiente_validacion",
      resultadoCobertura: { in: ["sin_vigencia", "sin_cobertura"] },
    },
    data: {
      estado: "agendada",
      esParticular: true,
      detalleCobertura: `${cita.detalleCobertura ?? ""} El paciente decidió agendar como particular.`.trim(),
    },
  });
  if (actualizada.count !== 1) return { ok: false, mensaje: "La cita ya no requiere esta decisión." };
  await registrarBitacora({
    usuarioId: actorId,
    entidad: "Cita",
    entidadId: citaId,
    accion: "acepta_particular",
    estadoAnterior: { estado: cita.estado, esParticular: cita.esParticular },
    estadoNuevo: { estado: "agendada", esParticular: true },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// RF-17: reglas de cancelación
// ---------------------------------------------------------------------------

export type EvaluacionCambio =
  | { permitido: true }
  | { permitido: false; motivo: "no-modificable" | "requiere-recepcion"; mensaje: string };

/**
 * Roles del hospital que pueden cancelar o reprogramar con menos de 24 horas de anticipación.
 * El coordinador de agenda cancela las citas afectadas por una novedad del médico (RF-27).
 */
const ROLES_RECEPCION: Rol[] = ["recepcionista", "agente_telefonico", "coordinador_agenda"];

/**
 * RF-17: el paciente puede cancelar (o reprogramar, que libera el horario igual que una
 * cancelación) solo con al menos 24 horas de anticipación; con menos tiempo debe
 * comunicarse con recepción. El personal de recepción puede hacerlo hasta la hora de la cita.
 */
export function evaluarCambio(
  cita: { estado: EstadoCita; inicio: Date },
  rol: Rol,
  ahora: Date = new Date(),
): EvaluacionCambio {
  if (!estadosModificables.includes(cita.estado) || cita.inicio <= ahora) {
    return { permitido: false, motivo: "no-modificable", mensaje: "Esta cita ya no se puede modificar." };
  }
  const horasRestantes = (cita.inicio.getTime() - ahora.getTime()) / 3_600_000;
  if (!ROLES_RECEPCION.includes(rol) && horasRestantes < configuracion.horasAnticipacionCancelacion) {
    return {
      permitido: false,
      motivo: "requiere-recepcion",
      mensaje: `Faltan menos de ${configuracion.horasAnticipacionCancelacion} horas para su cita. Para cancelarla o cambiarla, comuníquese con recepción.`,
    };
  }
  return { permitido: true };
}

// ---------------------------------------------------------------------------
// RF-16 y RF-17: reprogramación y cancelación
// ---------------------------------------------------------------------------

/**
 * RF-16: libera el espacio original y asigna el nuevo en una sola transacción. La cita
 * conserva su código; si estaba confirmada vuelve a «agendada» porque el nuevo horario no
 * ha sido confirmado. RF-20: el cambio queda en la bitácora con el estado anterior y el nuevo.
 * RF-24: el paciente recibe un correo y un SMS con el nuevo horario.
 */
export async function reprogramarCita(
  datos: { citaId: number; espacioId: number; actorId: number; rol: Rol },
  ahora: Date = new Date(),
): Promise<ResultadoAgenda> {
  try {
    await db.$transaction(async (tx) => {
      const cita = await tx.cita.findUnique({ where: { id: datos.citaId }, include: { espacio: true } });
      if (!cita) throw new ErrorAgenda("La cita no existe.", "no-encontrada");
      const evaluacion = evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, datos.rol, ahora);
      if (!evaluacion.permitido) {
        throw new ErrorAgenda(evaluacion.mensaje, evaluacion.motivo === "requiere-recepcion" ? "requiere-recepcion" : "no-cancelable");
      }
      if (cita.espacioId === datos.espacioId) throw new ErrorAgenda("Elija un horario distinto al actual.", "no-disponible");

      // Nuevo espacio: debe seguir libre o reservado por quien reprograma (RF-13 y RF-14).
      const tomado = await tx.espacio.updateMany({
        where: {
          AND: [
            { id: datos.espacioId },
            filtroEspacioValido(cita.especialidadId, ahora),
            filtroEspacioTomable(datos.actorId, ahora),
          ],
        },
        data: { estado: "ocupado", reservadoHasta: null, reservadoPorId: null },
      });
      if (tomado.count !== 1) throw new ErrorAgenda(MENSAJE_NO_DISPONIBLE, "no-disponible");

      // Espacio original: se libera (o sigue bloqueado si cae en una novedad del médico).
      await tx.espacio.update({ where: { id: cita.espacioId }, data: { estado: estadoAlLiberar(cita.espacio) } });

      const nuevoEstado: EstadoCita = cita.estado === "pendiente_validacion" ? "pendiente_validacion" : "agendada";
      const nuevoEspacio = await tx.espacio.findUniqueOrThrow({ where: { id: datos.espacioId } });
      await tx.cita.update({
        where: { id: cita.id },
        data: {
          espacioId: nuevoEspacio.id,
          espacioActivoId: nuevoEspacio.id,
          estado: nuevoEstado,
          recordatorioEnviadoEn: null,
        },
      });

      await registrarBitacora(
        {
          usuarioId: datos.actorId,
          entidad: "Cita",
          entidadId: cita.id,
          accion: "reprogramar_cita",
          estadoAnterior: { codigo: cita.codigo, estado: cita.estado, ...resumenEspacio(cita.espacio) },
          estadoNuevo: { codigo: cita.codigo, estado: nuevoEstado, ...resumenEspacio(nuevoEspacio) },
        },
        tx,
      );
      // RF-24: correo y SMS con el horario nuevo.
      await notificarCita(tx, cita.id, "reprogramada", { inicioAnterior: cita.espacio.inicio }, ahora);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorAgenda) return { ok: false, mensaje: error.message, codigo: error.codigo };
    if (esErrorUnico(error)) return { ok: false, mensaje: MENSAJE_NO_DISPONIBLE, codigo: "no-disponible" };
    throw error;
  }
}

/**
 * RF-17: cancela la cita con el motivo indicado y libera el espacio para otros pacientes
 * (salvo que caiga en una novedad del médico, en cuyo caso sigue bloqueado). El paciente
 * solo puede hacerlo con al menos 24 horas de anticipación. RF-20: queda en la bitácora.
 * RF-24: el paciente recibe un correo y un SMS; si la cancelación se debe a una novedad
 * del médico, el mensaje incluye el motivo y un enlace para elegir otro horario (RF-27).
 *
 * `actorId` es nulo cuando el paciente responde el recordatorio sin iniciar sesión (RF-26).
 */
export async function cancelarCita(
  datos: {
    citaId: number;
    motivo: string;
    actorId: number | null;
    rol: Rol;
    evento?: Extract<EventoCita, "cancelada" | "cancelada_novedad">;
    accion?: string;
  },
  ahora: Date = new Date(),
): Promise<ResultadoAgenda> {
  try {
    await db.$transaction(async (tx) => {
      const cita = await tx.cita.findUnique({ where: { id: datos.citaId }, include: { espacio: true } });
      if (!cita) throw new ErrorAgenda("La cita no existe.", "no-encontrada");
      const evaluacion = evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, datos.rol, ahora);
      if (!evaluacion.permitido) {
        throw new ErrorAgenda(evaluacion.mensaje, evaluacion.motivo === "requiere-recepcion" ? "requiere-recepcion" : "no-cancelable");
      }

      // Se cancela solo si nadie cambió el estado entretanto.
      const cancelada = await tx.cita.updateMany({
        where: { id: cita.id, estado: cita.estado },
        data: { estado: "cancelada", motivoCancelacion: datos.motivo, espacioActivoId: null },
      });
      if (cancelada.count !== 1) throw new ErrorAgenda("Esta cita ya no se puede modificar.", "no-cancelable");
      await tx.espacio.update({ where: { id: cita.espacioId }, data: { estado: estadoAlLiberar(cita.espacio) } });

      await registrarBitacora(
        {
          usuarioId: datos.actorId,
          entidad: "Cita",
          entidadId: cita.id,
          accion: datos.accion ?? "cancelar_cita",
          estadoAnterior: { codigo: cita.codigo, estado: cita.estado, ...resumenEspacio(cita.espacio) },
          estadoNuevo: { codigo: cita.codigo, estado: "cancelada", motivoCancelacion: datos.motivo },
        },
        tx,
      );
      // RF-24 y RF-27: correo y SMS con la cancelación.
      await notificarCita(tx, cita.id, datos.evento ?? "cancelada", {}, ahora);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorAgenda) return { ok: false, mensaje: error.message, codigo: error.codigo };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Consultas para las pantallas
// ---------------------------------------------------------------------------

export const incluirDetalleCita = {
  paciente: { include: { aseguradora: true } },
  especialidad: true,
  creadaPor: { select: { nombre: true, rol: true } },
  espacio: { include: { medico: true, consultorio: true } },
} satisfies Prisma.CitaInclude;

export type CitaDetallada = Prisma.CitaGetPayload<{ include: typeof incluirDetalleCita }>;

export async function obtenerCita(citaId: number) {
  return db.cita.findUnique({ where: { id: citaId }, include: incluirDetalleCita });
}

/** Citas del paciente: las activas (próximas) y el historial. */
export async function citasDelPaciente(pacienteId: number) {
  const [activas, historial] = await Promise.all([
    db.cita.findMany({
      where: { pacienteId, estado: { in: estadosCitaActiva } },
      include: incluirDetalleCita,
      orderBy: { espacio: { inicio: "asc" } },
    }),
    db.cita.findMany({
      where: { pacienteId, estado: { notIn: estadosCitaActiva } },
      include: incluirDetalleCita,
      orderBy: { espacio: { inicio: "desc" } },
      take: 20,
    }),
  ]);
  return { activas, historial };
}
