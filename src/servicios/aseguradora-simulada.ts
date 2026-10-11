import { configuracion } from "@/lib/configuracion";

/**
 * Reglas del servicio simulado de la aseguradora (sistema externo).
 *
 * Las respuestas son deterministas y dependen del último carácter del documento:
 * - `0`: el afiliado no tiene afiliación vigente.
 * - `8`: afiliación vigente con plan básico, que solo cubre medicina general y pediatría.
 * - `9`: la consulta en línea tarda más que el tiempo máximo de espera; los reintentos
 *   en segundo plano sí reciben respuesta (cobertura vigente).
 * - Cualquier otro: afiliación vigente con cobertura para la especialidad.
 */

export type SolicitudCobertura = {
  tipoDocumento: string;
  numeroDocumento: string;
  aseguradora: string;
  especialidad: string;
  /** Indica que la consulta es un reintento en segundo plano (RF-23). */
  reintento?: boolean;
};

export type RespuestaCobertura = {
  vigente: boolean;
  cubierta: boolean;
  mensaje: string;
};

const ESPECIALIDADES_PLAN_BASICO = ["medicina general", "pediatría"];

/** Demora simulada de los documentos terminados en 9: dos segundos más que el máximo de espera. */
export const milisegundosDemoraSimulada = (configuracion.segundosEsperaAseguradora + 2) * 1000;

/** Indica si la consulta de este documento se demora más que el tiempo máximo de espera. */
export function debeDemorarse(solicitud: SolicitudCobertura): boolean {
  return !solicitud.reintento && solicitud.numeroDocumento.trim().toUpperCase().endsWith("9");
}

/** RF-21: respuesta simulada de vigencia y cobertura para la especialidad. */
export function evaluarCobertura(solicitud: SolicitudCobertura): RespuestaCobertura {
  const ultimo = solicitud.numeroDocumento.trim().toUpperCase().slice(-1);
  if (ultimo === "0") {
    return {
      vigente: false,
      cubierta: false,
      mensaje: `El paciente no tiene una afiliación vigente con ${solicitud.aseguradora}.`,
    };
  }
  if (ultimo === "8" && !ESPECIALIDADES_PLAN_BASICO.includes(solicitud.especialidad.trim().toLowerCase())) {
    return {
      vigente: true,
      cubierta: false,
      mensaje: `El plan del paciente en ${solicitud.aseguradora} no cubre consultas de ${solicitud.especialidad.toLowerCase()}.`,
    };
  }
  return {
    vigente: true,
    cubierta: true,
    mensaje: `Afiliación vigente con cobertura para ${solicitud.especialidad.toLowerCase()}.`,
  };
}
