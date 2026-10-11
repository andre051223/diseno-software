import type { EstadoEspacio, TipoNovedad } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { estadosCitaActiva, nombresTipoNovedad } from "@/lib/etiquetas";
import { crearFechaBogota } from "@/lib/fechas";
import type { DatosNovedad } from "@/lib/validaciones/agenda";
import { cancelarCita, estadosModificables } from "./agendamiento";
import { registrarBitacora } from "./bitacora";

export type ResultadoNovedad =
  | { ok: true; id: number; espaciosBloqueados: number; citasAfectadas: number }
  | { ok: false; mensaje: string; campo?: string };

const ESTADOS_BLOQUEABLES: EstadoEspacio[] = ["libre", "reservado_temporal", "ocupado"];

/** Filtro de las citas activas del médico cuyo horario cae dentro del periodo. */
function filtroCitasDelPeriodo(medicoId: number, inicio: Date, fin: Date) {
  return {
    estado: { in: estadosCitaActiva },
    espacio: { medicoId, inicio: { lt: fin }, fin: { gt: inicio } },
  };
}

/**
 * RF-11: registra una novedad del médico (vacaciones, incapacidad o capacitación),
 * bloquea todos los espacios del periodo para que no se ofrezcan al agendar y devuelve
 * cuántas citas ya asignadas quedan afectadas, para listarlas al coordinador.
 */
export async function registrarNovedad(datos: DatosNovedad, actorId: number): Promise<ResultadoNovedad> {
  const medico = await db.medico.findUnique({ where: { id: datos.medicoId } });
  if (!medico) return { ok: false, mensaje: "El médico no existe.", campo: "medicoId" };

  const inicio = crearFechaBogota(datos.fechaInicio, datos.horaInicio);
  const fin = crearFechaBogota(datos.fechaFin, datos.horaFin);

  return db.$transaction(async (tx) => {
    const novedad = await tx.novedad.create({
      data: { medicoId: datos.medicoId, tipo: datos.tipo, inicio, fin, motivo: datos.motivo, creadaPorId: actorId },
    });

    // Se bloquean los espacios del periodo que no estén ya bloqueados por otra novedad.
    const bloqueados = await tx.espacio.updateMany({
      where: {
        medicoId: datos.medicoId,
        inicio: { lt: fin },
        fin: { gt: inicio },
        estado: { in: ESTADOS_BLOQUEABLES },
      },
      data: { estado: "bloqueado", novedadId: novedad.id, reservadoHasta: null, reservadoPorId: null },
    });

    const citasAfectadas = await tx.cita.count({ where: filtroCitasDelPeriodo(datos.medicoId, inicio, fin) });

    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Novedad",
        entidadId: novedad.id,
        accion: "registrar_novedad",
        estadoNuevo: {
          medicoId: datos.medicoId,
          tipo: datos.tipo,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          motivo: datos.motivo,
          espaciosBloqueados: bloqueados.count,
          citasAfectadas,
        },
      },
      tx,
    );

    return { ok: true as const, id: novedad.id, espaciosBloqueados: bloqueados.count, citasAfectadas };
  });
}

/** RF-11: citas ya asignadas en el periodo de la novedad, para que el coordinador las gestione. */
export async function citasAfectadasPorNovedad(novedad: { medicoId: number; inicio: Date; fin: Date }) {
  return db.cita.findMany({
    where: filtroCitasDelPeriodo(novedad.medicoId, novedad.inicio, novedad.fin),
    include: {
      paciente: true,
      especialidad: true,
      espacio: { include: { consultorio: true } },
    },
    orderBy: { espacio: { inicio: "asc" } },
  });
}

/** RF-27: motivo que se informa al paciente cuando la novedad cancela su cita. */
export function motivoCancelacionNovedad(tipo: TipoNovedad): string {
  return `El médico no estará disponible por ${nombresTipoNovedad[tipo].toLowerCase()}.`;
}

/**
 * RF-27: cancela las citas que la novedad dejó sin médico y avisa a cada paciente por
 * correo y SMS con el motivo y un enlace para elegir otro horario. Solo se cancelan las
 * citas futuras que el paciente aún no ha iniciado (agendadas, confirmadas o pendientes de
 * validación); los espacios siguen bloqueados por la novedad. Cada cancelación queda en la
 * bitácora (RF-20).
 */
export async function cancelarCitasPorNovedad(novedadId: number, actorId: number, ahora: Date = new Date()) {
  const novedad = await db.novedad.findUnique({ where: { id: novedadId } });
  if (!novedad) return { ok: false as const, mensaje: "La novedad no existe." };

  const citas = await db.cita.findMany({
    where: {
      estado: { in: estadosModificables },
      espacio: { medicoId: novedad.medicoId, inicio: { lt: novedad.fin, gt: ahora }, fin: { gt: novedad.inicio } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const motivo = motivoCancelacionNovedad(novedad.tipo);
  let canceladas = 0;
  for (const { id } of citas) {
    const resultado = await cancelarCita(
      { citaId: id, motivo, actorId, rol: "coordinador_agenda", evento: "cancelada_novedad", accion: "cancelar_cita_novedad" },
      ahora,
    );
    if (resultado.ok) canceladas++;
  }
  return { ok: true as const, canceladas, noCanceladas: citas.length - canceladas };
}
