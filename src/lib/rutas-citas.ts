import type { Rol } from "@/generated/prisma/enums";

/**
 * Rutas del asistente de agendamiento. El paciente agenda desde «Mis citas»; la
 * recepcionista y el agente telefónico, desde «Agendar cita» en nombre del paciente.
 */

export type ContextoAsistente = { rol: Rol; pacienteId: number; citaId?: number };

/** Filtros de búsqueda que se conservan al ir y volver entre los pasos. */
const FILTROS = ["especialidad", "medico", "desde", "hasta"] as const;

export function construirUrl(ruta: string, parametros: Record<string, string | number | undefined | null>): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

/** Deja solo los filtros conocidos de una cadena de consulta. */
export function filtrosDeConsulta(consulta: string | undefined): Record<string, string> {
  const origen = new URLSearchParams(consulta ?? "");
  const filtros: Record<string, string> = {};
  for (const clave of FILTROS) {
    const valor = origen.get(clave);
    if (valor && /^[\d-]{1,10}$/.test(valor)) filtros[clave] = valor;
  }
  return filtros;
}

export function esPersonalAgenda(rol: Rol): boolean {
  return rol === "recepcionista" || rol === "agente_telefonico";
}

/** Ruta del paso de búsqueda de horarios y los parámetros que siempre la acompañan. */
export function baseAsistente(contexto: ContextoAsistente): { ruta: string; fijos: Record<string, string> } {
  const personal = esPersonalAgenda(contexto.rol);
  if (contexto.citaId) {
    return { ruta: personal ? `/citas/${contexto.citaId}/reprogramar` : `/mis-citas/${contexto.citaId}/reprogramar`, fijos: {} };
  }
  return personal
    ? { ruta: "/agendar", fijos: { paciente: String(contexto.pacienteId) } }
    : { ruta: "/mis-citas/nueva", fijos: {} };
}

/** Detalle (y comprobante) de una cita según el rol. */
export function rutaDetalleCita(rol: Rol, citaId: number): string {
  return esPersonalAgenda(rol) ? `/citas/${citaId}` : `/mis-citas/${citaId}`;
}
