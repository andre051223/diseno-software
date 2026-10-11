import type { ResultadoCobertura } from "@/generated/prisma/enums";
import { configuracion } from "@/lib/configuracion";
import { db } from "@/lib/db";
import type { RespuestaCobertura, SolicitudCobertura } from "./aseguradora-simulada";
import { registrarBitacora } from "./bitacora";
import { urlAplicacion } from "./notificaciones";

/** Función que consulta a la aseguradora; las pruebas la reemplazan por una simulada. */
export type ConsultorAseguradora = (solicitud: SolicitudCobertura, senal: AbortSignal) => Promise<RespuestaCobertura>;

export type ResultadoConsulta = { resultado: ResultadoCobertura; detalle: string };

/** Consulta real al servicio de la aseguradora (ruta interna simulada). */
const consultarPorHttp: ConsultorAseguradora = async (solicitud, senal) => {
  const respuesta = await fetch(`${urlAplicacion()}/api/aseguradora/cobertura`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(solicitud),
    signal: senal,
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`La aseguradora respondió con el código ${respuesta.status}.`);
  return (await respuesta.json()) as RespuestaCobertura;
};

export const MENSAJE_SIN_RESPUESTA =
  "La aseguradora no respondió a tiempo. La cita queda pendiente de validación y la verificaremos en segundo plano.";

/**
 * RF-21: consulta a la aseguradora la vigencia de la afiliación y la cobertura para la
 * especialidad. RF-23: si no hay respuesta en el tiempo máximo (10 segundos) o el servicio
 * falla, el resultado es «sin respuesta».
 */
export async function consultarCobertura(
  solicitud: SolicitudCobertura,
  consultor: ConsultorAseguradora = consultarPorHttp,
  milisegundosEspera: number = configuracion.segundosEsperaAseguradora * 1000,
): Promise<ResultadoConsulta> {
  const senal = AbortSignal.timeout(milisegundosEspera);
  try {
    // La espera se corta también aquí por si el consultor no respeta la señal.
    const respuesta = await Promise.race([
      consultor(solicitud, senal),
      new Promise<never>((_, rechazar) => {
        senal.addEventListener("abort", () => rechazar(new Error("Tiempo de espera agotado.")), { once: true });
      }),
    ]);
    if (!respuesta.vigente) return { resultado: "sin_vigencia", detalle: respuesta.mensaje };
    if (!respuesta.cubierta) return { resultado: "sin_cobertura", detalle: respuesta.mensaje };
    return { resultado: "cubierta", detalle: respuesta.mensaje };
  } catch {
    return { resultado: "sin_respuesta", detalle: MENSAJE_SIN_RESPUESTA };
  }
}

/** Arma la solicitud a la aseguradora con los datos del paciente y la especialidad. */
export async function solicitudParaPaciente(
  pacienteId: number,
  especialidadId: number,
  reintento = false,
): Promise<SolicitudCobertura> {
  const [paciente, especialidad] = await Promise.all([
    db.paciente.findUniqueOrThrow({ where: { id: pacienteId }, include: { aseguradora: true } }),
    db.especialidad.findUniqueOrThrow({ where: { id: especialidadId } }),
  ]);
  return {
    tipoDocumento: paciente.tipoDocumento,
    numeroDocumento: paciente.numeroDocumento,
    aseguradora: paciente.aseguradora.nombre,
    especialidad: especialidad.nombre,
    reintento,
  };
}

/**
 * RF-23: reintenta en segundo plano la validación de una cita pendiente. Si la aseguradora
 * confirma la cobertura, la cita pasa a «agendada». Si responde que no hay vigencia o
 * cobertura, la cita sigue pendiente con el motivo, para que el paciente o la recepción
 * decidan si se atiende como particular (RF-22). Si tampoco responde, se cuenta el intento.
 */
export async function reintentarCoberturaCita(
  citaId: number,
  consultor: ConsultorAseguradora = consultarPorHttp,
): Promise<ResultadoCobertura | null> {
  const cita = await db.cita.findUnique({ where: { id: citaId } });
  if (!cita || cita.estado !== "pendiente_validacion" || cita.resultadoCobertura !== "sin_respuesta") return null;

  const solicitud = await solicitudParaPaciente(cita.pacienteId, cita.especialidadId, true);
  const { resultado, detalle } = await consultarCobertura(solicitud, consultor);

  const datos =
    resultado === "sin_respuesta"
      ? { intentosCobertura: { increment: 1 } }
      : {
          intentosCobertura: { increment: 1 },
          resultadoCobertura: resultado,
          detalleCobertura: detalle,
          estado: resultado === "cubierta" ? ("agendada" as const) : ("pendiente_validacion" as const),
        };

  // Solo se actualiza si nadie cambió la cita mientras se esperaba a la aseguradora.
  const actualizada = await db.cita.updateMany({
    where: { id: citaId, estado: "pendiente_validacion", resultadoCobertura: "sin_respuesta" },
    data: datos,
  });
  if (actualizada.count === 0) return null;

  if (resultado !== "sin_respuesta") {
    await registrarBitacora({
      usuarioId: null,
      entidad: "Cita",
      entidadId: citaId,
      accion: "reintentar_cobertura",
      estadoAnterior: { estado: cita.estado, resultadoCobertura: cita.resultadoCobertura },
      estadoNuevo: {
        estado: resultado === "cubierta" ? "agendada" : "pendiente_validacion",
        resultadoCobertura: resultado,
        detalleCobertura: detalle,
      },
    });
  }
  return resultado;
}

/** RF-23: reintenta todas las validaciones pendientes; lo usa la tarea programada. */
export async function reintentarCoberturasPendientes(consultor: ConsultorAseguradora = consultarPorHttp) {
  const pendientes = await db.cita.findMany({
    where: { estado: "pendiente_validacion", resultadoCobertura: "sin_respuesta" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const resumen = { revisadas: pendientes.length, cubiertas: 0, rechazadas: 0, sinRespuesta: 0 };
  for (const { id } of pendientes) {
    const resultado = await reintentarCoberturaCita(id, consultor);
    if (resultado === "cubierta") resumen.cubiertas++;
    else if (resultado === "sin_respuesta") resumen.sinRespuesta++;
    else if (resultado) resumen.rechazadas++;
  }
  return resumen;
}
