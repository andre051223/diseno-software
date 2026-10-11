import type { Prisma } from "@/generated/prisma/client";
import type { EstadoCita } from "@/generated/prisma/enums";
import { configuracion } from "@/lib/configuracion";
import { db } from "@/lib/db";
import { aFechaIso, crearFechaBogota } from "@/lib/fechas";
import { sumarDiasIso } from "./generador-espacios";
import { incluirDetalleCita, type ResultadoAgenda } from "./agendamiento";
import { registrarBitacora } from "./bitacora";

/** Estados en los que el paciente todavía puede registrar su llegada (RF-28) o faltar (RF-31). */
export const estadosEsperandoLlegada: EstadoCita[] = ["agendada", "confirmada", "pendiente_validacion"];

const toleranciaMs = () => configuracion.minutosParaInasistencia * 60_000;

/** Inicio y fin (exclusivo) del día de Bogotá que contiene la fecha indicada. */
export function rangoDelDia(fecha: Date) {
  const dia = aFechaIso(fecha);
  return { desde: crearFechaBogota(dia, "00:00"), hasta: crearFechaBogota(sumarDiasIso(dia, 1), "00:00") };
}

/** RF-31: hora a partir de la cual una cita sin llegada se marca como inasistencia. */
export function limiteLlegada(inicio: Date): Date {
  return new Date(inicio.getTime() + toleranciaMs());
}

export type EvaluacionLlegada = { permitido: true } | { permitido: false; mensaje: string };

/**
 * RF-28: la llegada se registra el mismo día de la cita, mientras esté pendiente de llegada
 * y antes de que venza la tolerancia de 20 minutos (RF-31).
 */
export function evaluarLlegada(cita: { estado: EstadoCita; inicio: Date }, ahora: Date = new Date()): EvaluacionLlegada {
  if (!estadosEsperandoLlegada.includes(cita.estado)) {
    return { permitido: false, mensaje: "La cita no está pendiente de llegada." };
  }
  const { desde, hasta } = rangoDelDia(ahora);
  if (cita.inicio < desde || cita.inicio >= hasta) {
    return { permitido: false, mensaje: "Solo se registra la llegada de las citas de hoy." };
  }
  if (ahora > limiteLlegada(cita.inicio)) {
    return {
      permitido: false,
      mensaje: `Pasaron más de ${configuracion.minutosParaInasistencia} minutos desde la hora de la cita. El paciente debe solicitar una nueva cita.`,
    };
  }
  return { permitido: true };
}

// ---------------------------------------------------------------------------
// RF-28: registro de llegada en recepción
// ---------------------------------------------------------------------------

/**
 * RF-28: busca las citas de hoy por código de cita o por número de documento del paciente.
 */
export async function buscarCitasParaLlegada(termino: string, ahora: Date = new Date()) {
  const texto = termino.trim().toUpperCase();
  if (texto.length < 3) return [];
  const { desde, hasta } = rangoDelDia(ahora);
  return db.cita.findMany({
    where: {
      espacio: { inicio: { gte: desde, lt: hasta } },
      OR: [{ codigo: texto }, { paciente: { numeroDocumento: texto } }],
    },
    include: incluirDetalleCita,
    orderBy: { espacio: { inicio: "asc" } },
  });
}

/** Citas del día para la recepción, con filtro opcional por estado. */
export async function citasDelDia(
  filtro: { estado?: EstadoCita; pagina: number; porPagina: number },
  ahora: Date = new Date(),
) {
  const { desde, hasta } = rangoDelDia(ahora);
  const where: Prisma.CitaWhereInput = {
    espacio: { inicio: { gte: desde, lt: hasta } },
    ...(filtro.estado ? { estado: filtro.estado } : {}),
  };
  const [total, citas, porEstado] = await Promise.all([
    db.cita.count({ where }),
    db.cita.findMany({
      where,
      include: incluirDetalleCita,
      orderBy: [{ espacio: { inicio: "asc" } }, { id: "asc" }],
      skip: (filtro.pagina - 1) * filtro.porPagina,
      take: filtro.porPagina,
    }),
    db.cita.groupBy({
      by: ["estado"],
      where: { espacio: { inicio: { gte: desde, lt: hasta } } },
      _count: { _all: true },
    }),
  ]);
  const conteo = Object.fromEntries(porEstado.map((fila) => [fila.estado, fila._count._all])) as Partial<
    Record<EstadoCita, number>
  >;
  return { total, citas, conteo };
}

/**
 * RF-28: registra la hora de llegada del paciente y deja la cita «en sala», lo que ve el
 * médico en su agenda del día (RF-29). El cambio queda en la bitácora.
 */
export async function registrarLlegada(citaId: number, actorId: number, ahora: Date = new Date()): Promise<ResultadoAgenda> {
  const cita = await db.cita.findUnique({ where: { id: citaId }, include: { espacio: true } });
  if (!cita) return { ok: false, mensaje: "La cita no existe.", codigo: "no-encontrada" };
  const evaluacion = evaluarLlegada({ estado: cita.estado, inicio: cita.espacio.inicio }, ahora);
  if (!evaluacion.permitido) return { ok: false, mensaje: evaluacion.mensaje, codigo: "no-cancelable" };

  return db.$transaction(async (tx) => {
    // Condicional: si dos recepcionistas registran a la vez, solo una lo logra.
    const actualizada = await tx.cita.updateMany({
      where: { id: citaId, estado: { in: estadosEsperandoLlegada }, horaLlegada: null },
      data: { estado: "en_sala", horaLlegada: ahora },
    });
    if (actualizada.count !== 1) {
      return { ok: false as const, mensaje: "La llegada ya fue registrada.", codigo: "no-cancelable" as const };
    }
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Cita",
        entidadId: citaId,
        accion: "registrar_llegada",
        estadoAnterior: { codigo: cita.codigo, estado: cita.estado },
        estadoNuevo: { codigo: cita.codigo, estado: "en_sala", horaLlegada: ahora.toISOString() },
      },
      tx,
    );
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// RF-29 y RF-30: agenda del médico y atención
// ---------------------------------------------------------------------------

/** RF-29: lista del día del médico con hora, paciente y estado. */
export async function agendaDelDia(medicoId: number, ahora: Date = new Date()) {
  const { desde, hasta } = rangoDelDia(ahora);
  return db.cita.findMany({
    where: { espacio: { medicoId, inicio: { gte: desde, lt: hasta } } },
    include: incluirDetalleCita,
    orderBy: [{ espacio: { inicio: "asc" } }, { id: "asc" }],
  });
}

/** Cita del médico (solo puede ver y atender las suyas). */
export async function citaDelMedico(citaId: number, medicoId: number) {
  const cita = await db.cita.findUnique({ where: { id: citaId }, include: incluirDetalleCita });
  if (!cita || cita.espacio.medicoId !== medicoId) return null;
  return cita;
}

/** RF-30: inicio de la atención del paciente que está en sala. */
export async function iniciarAtencion(citaId: number, medicoId: number, actorId: number, ahora: Date = new Date()): Promise<ResultadoAgenda> {
  const cita = await citaDelMedico(citaId, medicoId);
  if (!cita) return { ok: false, mensaje: "La cita no existe.", codigo: "no-encontrada" };

  return db.$transaction(async (tx) => {
    const actualizada = await tx.cita.updateMany({
      where: { id: citaId, estado: "en_sala", inicioAtencion: null },
      data: { inicioAtencion: ahora },
    });
    if (actualizada.count !== 1) {
      return {
        ok: false as const,
        mensaje: "Solo se puede iniciar la atención de un paciente en sala que aún no ha sido atendido.",
        codigo: "no-cancelable" as const,
      };
    }
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Cita",
        entidadId: citaId,
        accion: "iniciar_atencion",
        estadoAnterior: { codigo: cita.codigo, estado: cita.estado, inicioAtencion: null },
        estadoNuevo: { codigo: cita.codigo, estado: "en_sala", inicioAtencion: ahora.toISOString() },
      },
      tx,
    );
    return { ok: true as const };
  });
}

/** RF-30: fin de la atención; la cita queda «atendida». */
export async function finalizarAtencion(citaId: number, medicoId: number, actorId: number, ahora: Date = new Date()): Promise<ResultadoAgenda> {
  const cita = await citaDelMedico(citaId, medicoId);
  if (!cita) return { ok: false, mensaje: "La cita no existe.", codigo: "no-encontrada" };

  return db.$transaction(async (tx) => {
    const actualizada = await tx.cita.updateMany({
      where: { id: citaId, estado: "en_sala", inicioAtencion: { not: null }, finAtencion: null },
      data: { estado: "atendida", finAtencion: ahora },
    });
    if (actualizada.count !== 1) {
      return {
        ok: false as const,
        mensaje: "Primero registre el inicio de la atención.",
        codigo: "no-cancelable" as const,
      };
    }
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Cita",
        entidadId: citaId,
        accion: "finalizar_atencion",
        estadoAnterior: { codigo: cita.codigo, estado: cita.estado },
        estadoNuevo: { codigo: cita.codigo, estado: "atendida", finAtencion: ahora.toISOString() },
      },
      tx,
    );
    return { ok: true as const };
  });
}

/** Paciente que el médico puede consultar en la historia clínica simulada: debe tener una cita con él. */
export async function pacienteDelMedico(pacienteId: number, medicoId: number) {
  return db.paciente.findFirst({
    where: { id: pacienteId, citas: { some: { espacio: { medicoId } } } },
    include: { aseguradora: true },
  });
}

// ---------------------------------------------------------------------------
// RF-31: inasistencias
// ---------------------------------------------------------------------------

/**
 * RF-31: marca como inasistencia las citas que siguen sin registro de llegada 20 minutos
 * después de su hora. El espacio sigue contando como ocupado para los reportes de
 * ocupación. Cada marca queda en la bitácora; lo ejecuta la tarea programada.
 */
export async function marcarInasistencias(ahora: Date = new Date()) {
  const limite = new Date(ahora.getTime() - toleranciaMs());
  const vencidas = await db.cita.findMany({
    where: { estado: { in: estadosEsperandoLlegada }, horaLlegada: null, espacio: { inicio: { lte: limite } } },
    select: { id: true, codigo: true, estado: true },
    orderBy: { id: "asc" },
  });

  let marcadas = 0;
  for (const cita of vencidas) {
    const marcada = await db.$transaction(async (tx) => {
      const actualizada = await tx.cita.updateMany({
        where: { id: cita.id, estado: { in: estadosEsperandoLlegada }, horaLlegada: null },
        data: { estado: "inasistencia" },
      });
      if (actualizada.count !== 1) return false;
      await registrarBitacora(
        {
          usuarioId: null,
          entidad: "Cita",
          entidadId: cita.id,
          accion: "marcar_inasistencia",
          estadoAnterior: { codigo: cita.codigo, estado: cita.estado },
          estadoNuevo: { codigo: cita.codigo, estado: "inasistencia" },
        },
        tx,
      );
      return true;
    });
    if (marcada) marcadas++;
  }
  return marcadas;
}
