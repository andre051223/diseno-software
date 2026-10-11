/**
 * Parámetros configurables del sistema.
 *
 * Son supuestos pendientes de validar con el Hospital Central San Rafael;
 * cualquier ajuste se hace solo en este archivo.
 */
export const configuracion = {
  /** RF-03: intentos fallidos consecutivos antes de bloquear la cuenta. */
  intentosFallidosAntesDeBloqueo: 3,
  /** RF-03: duración del bloqueo de cuenta, en minutos. */
  minutosBloqueoCuenta: 15,
  /** RF-04: vigencia del enlace de recuperación de contraseña, en minutos. */
  minutosVigenciaRecuperacion: 30,
  /** RF-14: duración de la reserva temporal de un espacio, en minutos. */
  minutosReservaTemporal: 5,
  /** RF-17: anticipación mínima para que el paciente cancele, en horas. */
  horasAnticipacionCancelacion: 24,
  /** RF-25: horas antes de la cita en que se envía el recordatorio. */
  horasAntesRecordatorio: 48,
  /** RF-23: tiempo máximo de espera a la aseguradora, en segundos. */
  segundosEsperaAseguradora: 10,
  /** RF-31: minutos después de la hora de la cita para marcar la inasistencia. */
  minutosParaInasistencia: 20,
  /** RF-10: semanas hacia adelante para las que se generan espacios. */
  semanasGeneracionEspacios: 8,
  /** Duración de la sesión iniciada, en horas. */
  horasDuracionSesion: 8,
  /** Zona horaria del hospital. */
  zonaHoraria: "America/Bogota",
} as const;

export type Configuracion = typeof configuracion;
