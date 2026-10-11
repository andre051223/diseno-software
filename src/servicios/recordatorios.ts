import type { EstadoCita } from "@/generated/prisma/enums";
import { configuracion } from "@/lib/configuracion";
import { db } from "@/lib/db";
import { cancelarCita, evaluarCambio, incluirDetalleCita, type ResultadoAgenda } from "./agendamiento";
import { registrarBitacora } from "./bitacora";
import { notificarCita } from "./mensajes-cita";

/**
 * RF-25: envía el recordatorio a las citas agendadas que empiezan dentro de las próximas
 * 48 horas y aún no lo recibieron. El correo y el SMS llevan los enlaces para confirmar o
 * cancelar. La marca `recordatorioEnviadoEn` se pone de forma condicional, así una cita
 * nunca recibe dos recordatorios aunque la tarea se ejecute dos veces a la vez.
 */
export async function enviarRecordatorios(ahora: Date = new Date()) {
  const limite = new Date(ahora.getTime() + configuracion.horasAntesRecordatorio * 3_600_000);
  const citas = await db.cita.findMany({
    where: { estado: "agendada", recordatorioEnviadoEn: null, espacio: { inicio: { gt: ahora, lte: limite } } },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let enviados = 0;
  for (const { id } of citas) {
    const enviado = await db.$transaction(async (tx) => {
      const marcada = await tx.cita.updateMany({
        where: { id, estado: "agendada", recordatorioEnviadoEn: null },
        data: { recordatorioEnviadoEn: ahora },
      });
      if (marcada.count !== 1) return false;
      await notificarCita(tx, id, "recordatorio", {}, ahora);
      return true;
    });
    if (enviado) enviados++;
  }
  return enviados;
}

/** RF-26: cita a la que corresponde el enlace del recordatorio. */
export async function obtenerCitaPorToken(token: string) {
  if (!token || token.length > 100) return null;
  return db.cita.findUnique({ where: { tokenRespuesta: token }, include: incluirDetalleCita });
}

/**
 * RF-26: el paciente confirma su asistencia desde el recordatorio. La cita pasa a
 * «confirmada», lo que ven la recepción y la agenda del médico. RF-24: recibe un correo y
 * un SMS con la confirmación.
 */
export async function confirmarDesdeRecordatorio(token: string, ahora: Date = new Date()): Promise<ResultadoAgenda> {
  const cita = await obtenerCitaPorToken(token);
  if (!cita) return { ok: false, mensaje: "El enlace no es válido.", codigo: "no-encontrada" };
  if (cita.estado === "confirmada") return { ok: true };
  if (cita.estado !== "agendada" || cita.espacio.inicio <= ahora) {
    return { ok: false, mensaje: "Esta cita ya no se puede confirmar.", codigo: "no-cancelable" };
  }

  const confirmada = await db.$transaction(async (tx) => {
    const actualizada = await tx.cita.updateMany({
      where: { id: cita.id, estado: "agendada" },
      data: { estado: "confirmada" },
    });
    if (actualizada.count !== 1) return false;
    await registrarBitacora(
      {
        usuarioId: cita.paciente.usuarioId,
        entidad: "Cita",
        entidadId: cita.id,
        accion: "confirmar_cita_recordatorio",
        estadoAnterior: { codigo: cita.codigo, estado: cita.estado },
        estadoNuevo: { codigo: cita.codigo, estado: "confirmada" },
      },
      tx,
    );
    await notificarCita(tx, cita.id, "confirmada", {}, ahora);
    return true;
  });
  return confirmada ? { ok: true } : { ok: false, mensaje: "Esta cita ya no se puede confirmar.", codigo: "no-cancelable" };
}

/**
 * RF-26: el paciente cancela desde el recordatorio. Se aplican las mismas reglas que en el
 * portal (RF-17: motivo obligatorio y al menos 24 horas de anticipación); el espacio queda
 * libre y la cancelación se refleja en la recepción y en la agenda del médico.
 */
export async function cancelarDesdeRecordatorio(
  token: string,
  motivo: string,
  ahora: Date = new Date(),
): Promise<ResultadoAgenda> {
  const cita = await obtenerCitaPorToken(token);
  if (!cita) return { ok: false, mensaje: "El enlace no es válido.", codigo: "no-encontrada" };
  return cancelarCita(
    { citaId: cita.id, motivo, actorId: cita.paciente.usuarioId, rol: "paciente", accion: "cancelar_cita_recordatorio" },
    ahora,
  );
}

/** Qué puede hacer el paciente con la cita desde el enlace del recordatorio. */
export function opcionesRespuesta(cita: { estado: EstadoCita; espacio: { inicio: Date } }, ahora: Date = new Date()) {
  const cambio = evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, "paciente", ahora);
  return {
    puedeConfirmar: cita.estado === "agendada" && cita.espacio.inicio > ahora,
    puedeCancelar: cambio.permitido,
    // RF-17: con menos de 24 horas se indica que debe comunicarse con recepción.
    avisoCancelacion: !cambio.permitido && cambio.motivo === "requiere-recepcion" ? cambio.mensaje : null,
  };
}
