import { db, type TransaccionDb } from "@/lib/db";
import { nombreMedico } from "@/lib/etiquetas";
import { diaSemanaIso, formatearFecha, formatearHora, nombresDiasSemana } from "@/lib/fechas";
import { registrarNotificacion, urlAplicacion } from "./notificaciones";

/** Hechos de una cita que generan mensajes al paciente. */
export type EventoCita =
  | "agendada"
  | "reprogramada"
  | "cancelada"
  | "confirmada"
  | "recordatorio"
  | "cancelada_novedad";

/** Datos de la cita que se incluyen en los mensajes. */
export type DatosMensajeCita = {
  codigo: string;
  pendienteValidacion: boolean;
  paciente: { nombres: string };
  especialidad: string;
  medico: { nombres: string; apellidos: string };
  consultorio: { nombre: string; ubicacion: string };
  inicio: Date;
  motivoCancelacion?: string | null;
  /** Fecha y hora anteriores, para la reprogramación. */
  inicioAnterior?: Date | null;
  /** Enlaces para responder el recordatorio (RF-25) o para pedir una nueva cita (RF-27). */
  enlaces?: { confirmar?: string; cancelar?: string; reprogramar?: string };
};

export type MensajesCita = {
  correo: { asunto: string; contenido: string };
  sms: { contenido: string };
};

const PIE_CORREO = "Hospital Central San Rafael · Línea de citas: (601) 555 0100.";

function fechaYHora(inicio: Date) {
  return `${nombresDiasSemana[diaSemanaIso(inicio)].toLowerCase()} ${formatearFecha(inicio)} a las ${formatearHora(inicio)}`;
}

/**
 * RF-24, RF-25 y RF-27: arma el correo y el SMS de un hecho de la cita con los datos
 * actualizados (código, fecha, hora, especialidad, médico y consultorio).
 */
export function construirMensajesCita(evento: EventoCita, datos: DatosMensajeCita): MensajesCita {
  const cuando = fechaYHora(datos.inicio);
  const detalle = [
    `Código: ${datos.codigo}`,
    `Fecha y hora: ${cuando}`,
    `Especialidad: ${datos.especialidad}`,
    `Médico: ${nombreMedico(datos.medico)}`,
    `Consultorio: ${datos.consultorio.nombre} (${datos.consultorio.ubicacion})`,
  ].join("\n");
  const saludo = `Hola, ${datos.paciente.nombres}.`;
  const resumenSms = `cita ${datos.codigo} de ${datos.especialidad} el ${formatearFecha(datos.inicio)} a las ${formatearHora(datos.inicio)}, ${datos.consultorio.nombre}`;
  const enlaces = datos.enlaces ?? {};

  switch (evento) {
    case "agendada": {
      const pendiente = datos.pendienteValidacion
        ? "\n\nLa aseguradora no respondió a tiempo: la cita quedó reservada y pendiente de validación de cobertura. Le avisaremos si se requiere alguna gestión."
        : "";
      return {
        correo: {
          asunto: `Cita agendada ${datos.codigo}`,
          contenido: `${saludo} Su cita quedó agendada.\n\n${detalle}${pendiente}\n\nLlegue 20 minutos antes con su documento de identidad.\n${PIE_CORREO}`,
        },
        sms: {
          contenido: `Hospital San Rafael: su ${resumenSms} quedó agendada${datos.pendienteValidacion ? " (pendiente de validación de cobertura)" : ""}.`,
        },
      };
    }
    case "reprogramada": {
      const anterior = datos.inicioAnterior ? `\nHorario anterior: ${fechaYHora(datos.inicioAnterior)} (quedó liberado).` : "";
      return {
        correo: {
          asunto: `Cita reprogramada ${datos.codigo}`,
          contenido: `${saludo} Su cita cambió de horario. El código se mantiene.\n\n${detalle}${anterior}\n\n${PIE_CORREO}`,
        },
        sms: { contenido: `Hospital San Rafael: su ${resumenSms} fue reprogramada.` },
      };
    }
    case "cancelada": {
      const motivo = datos.motivoCancelacion ? `\nMotivo: ${datos.motivoCancelacion}` : "";
      return {
        correo: {
          asunto: `Cita cancelada ${datos.codigo}`,
          contenido: `${saludo} Su cita fue cancelada y el horario quedó disponible.\n\n${detalle}${motivo}\n\n${PIE_CORREO}`,
        },
        sms: { contenido: `Hospital San Rafael: su ${resumenSms} fue cancelada.` },
      };
    }
    case "confirmada":
      return {
        correo: {
          asunto: `Asistencia confirmada ${datos.codigo}`,
          contenido: `${saludo} Gracias por confirmar su asistencia.\n\n${detalle}\n\nLlegue 20 minutos antes con su documento de identidad.\n${PIE_CORREO}`,
        },
        sms: { contenido: `Hospital San Rafael: confirmamos su asistencia a la ${resumenSms}.` },
      };
    case "recordatorio":
      return {
        correo: {
          asunto: `Recordatorio de su cita ${datos.codigo}`,
          contenido:
            `${saludo} Le recordamos su próxima cita.\n\n${detalle}\n\n` +
            `Confirme su asistencia: ${enlaces.confirmar ?? ""}\n` +
            `Si no puede asistir, cancele la cita para liberar el horario: ${enlaces.cancelar ?? ""}\n\n${PIE_CORREO}`,
        },
        sms: {
          contenido: `Hospital San Rafael: recuerde su ${resumenSms}. Confirme: ${enlaces.confirmar ?? ""} Cancele: ${enlaces.cancelar ?? ""}`,
        },
      };
    case "cancelada_novedad": {
      const motivo = datos.motivoCancelacion ?? "Novedad en la agenda del médico.";
      return {
        correo: {
          asunto: `Su cita ${datos.codigo} fue cancelada por el hospital`,
          contenido:
            `${saludo} Lamentamos informarle que el hospital canceló su cita por una novedad del médico.\n\n${detalle}\nMotivo: ${motivo}\n\n` +
            `Puede elegir un nuevo horario aquí: ${enlaces.reprogramar ?? ""}\n` +
            `También puede comunicarse con la línea de citas.\n${PIE_CORREO}`,
        },
        sms: {
          contenido: `Hospital San Rafael: su ${resumenSms} fue cancelada (${motivo}). Elija un nuevo horario: ${enlaces.reprogramar ?? ""}`,
        },
      };
    }
  }
}

/** Enlaces públicos para responder el recordatorio sin iniciar sesión (RF-25). */
export function enlacesRespuesta(tokenRespuesta: string) {
  const base = `${urlAplicacion()}/responder-cita/${tokenRespuesta}`;
  return { confirmar: `${base}?accion=confirmar`, cancelar: `${base}?accion=cancelar` };
}

/** RF-27: enlace para que el paciente elija un nuevo horario en la misma especialidad. */
export function enlaceNuevaCita(especialidadId: number) {
  return `${urlAplicacion()}/mis-citas/nueva?especialidad=${especialidadId}`;
}

/**
 * RF-24: registra en la bandeja de salida un correo y un SMS al paciente con los datos
 * actualizados de la cita. Se llama dentro de la misma transacción que el cambio, así el
 * mensaje solo existe si el cambio se guardó.
 */
export async function notificarCita(
  cliente: TransaccionDb | typeof db,
  citaId: number,
  evento: EventoCita,
  extra: Pick<DatosMensajeCita, "inicioAnterior"> = {},
  ahora: Date = new Date(),
) {
  const cita = await cliente.cita.findUniqueOrThrow({
    where: { id: citaId },
    include: { paciente: true, especialidad: true, espacio: { include: { medico: true, consultorio: true } } },
  });
  const enlaces =
    evento === "recordatorio"
      ? enlacesRespuesta(cita.tokenRespuesta)
      : evento === "cancelada_novedad"
        ? { reprogramar: enlaceNuevaCita(cita.especialidadId) }
        : undefined;
  const mensajes = construirMensajesCita(evento, {
    codigo: cita.codigo,
    pendienteValidacion: cita.estado === "pendiente_validacion",
    paciente: cita.paciente,
    especialidad: cita.especialidad.nombre,
    medico: cita.espacio.medico,
    consultorio: cita.espacio.consultorio,
    inicio: cita.espacio.inicio,
    motivoCancelacion: cita.motivoCancelacion,
    inicioAnterior: extra.inicioAnterior,
    enlaces,
  });
  const tipo = `cita_${evento}`;
  const comun = { pacienteId: cita.pacienteId, citaId: cita.id, usuarioId: cita.paciente.usuarioId, tipo };
  await registrarNotificacion(
    { ...comun, destinatario: cita.paciente.correo, canal: "correo", asunto: mensajes.correo.asunto, contenido: mensajes.correo.contenido },
    cliente,
    ahora,
  );
  await registrarNotificacion(
    { ...comun, destinatario: cita.paciente.telefono, canal: "sms", contenido: mensajes.sms.contenido },
    cliente,
    ahora,
  );
}
