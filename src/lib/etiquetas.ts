import type {
  CanalOrigen,
  EstadoCita,
  ResultadoCobertura,
  TipoDocumento,
  TipoNovedad,
} from "@/generated/prisma/enums";

/** Estados de cita que mantienen ocupado el espacio y cuentan como cita activa (RF-13 y RF-18). */
export const estadosCitaActiva: EstadoCita[] = ["agendada", "confirmada", "pendiente_validacion", "en_sala"];

/** Nombre visible y tono de cada estado de cita: el estado siempre se muestra con texto, no solo con color. */
export const estadosCita: Record<
  EstadoCita,
  { etiqueta: string; tono: "neutro" | "exito" | "advertencia" | "peligro" | "info" }
> = {
  agendada: { etiqueta: "Agendada", tono: "info" },
  confirmada: { etiqueta: "Confirmada", tono: "exito" },
  pendiente_validacion: { etiqueta: "Pendiente de validación", tono: "advertencia" },
  en_sala: { etiqueta: "En sala", tono: "info" },
  atendida: { etiqueta: "Atendida", tono: "neutro" },
  cancelada: { etiqueta: "Cancelada", tono: "peligro" },
  inasistencia: { etiqueta: "Inasistencia", tono: "peligro" },
};

/** Nombres visibles de los tipos de documento (RF-05). */
export const nombresTipoDocumento: Record<TipoDocumento, string> = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  RC: "Registro civil",
  PA: "Pasaporte",
};

export const listaTiposDocumento = Object.keys(nombresTipoDocumento) as TipoDocumento[];

/** Nombres visibles de los tipos de novedad del médico (RF-11). */
export const nombresTipoNovedad: Record<TipoNovedad, string> = {
  vacaciones: "Vacaciones",
  incapacidad: "Incapacidad",
  capacitacion: "Capacitación",
};

export const listaTiposNovedad = Object.keys(nombresTipoNovedad) as TipoNovedad[];

/** Nombre completo del médico para listas y comprobantes. */
export function nombreMedico(medico: { nombres: string; apellidos: string }): string {
  return `${medico.nombres} ${medico.apellidos}`;
}

/** Nombre completo del paciente. */
export function nombrePaciente(paciente: { nombres: string; apellidos: string }): string {
  return `${paciente.nombres} ${paciente.apellidos}`;
}

/** RF-19: nombres visibles de los canales de origen de la cita. */
export const nombresCanal: Record<CanalOrigen, string> = {
  ventanilla: "Ventanilla",
  telefono: "Teléfono",
  portal_web: "Portal web",
  aplicacion_movil: "Aplicación móvil",
};

/** RF-21 a RF-23: nombres visibles del resultado de la validación con la aseguradora. */
export const nombresResultadoCobertura: Record<ResultadoCobertura, string> = {
  cubierta: "Cubierta por la aseguradora",
  sin_vigencia: "Sin afiliación vigente",
  sin_cobertura: "Sin cobertura para la especialidad",
  sin_respuesta: "La aseguradora no respondió",
};
