import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { configuracion } from "./configuracion";

const ZONA = configuracion.zonaHoraria;

/** Convierte una fecha a la zona horaria del hospital. */
export function enBogota(fecha: Date | string | number): TZDate {
  return new TZDate(new Date(fecha), ZONA);
}

/** Fecha en formato dd/mm/aaaa. */
export function formatearFecha(fecha: Date | string | number): string {
  return format(enBogota(fecha), "dd/MM/yyyy");
}

/** Hora en formato de 24 h (HH:mm). */
export function formatearHora(fecha: Date | string | number): string {
  return format(enBogota(fecha), "HH:mm");
}

/** Fecha y hora: dd/mm/aaaa HH:mm. */
export function formatearFechaHora(fecha: Date | string | number): string {
  return format(enBogota(fecha), "dd/MM/yyyy HH:mm");
}

/** Fecha larga en español, por ejemplo «lunes, 12 de octubre de 2026». */
export function formatearFechaLarga(fecha: Date | string | number): string {
  return format(enBogota(fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Crea el instante UTC que corresponde a una fecha (aaaa-mm-dd) y una hora (HH:mm)
 * expresadas en la hora local de Bogotá.
 */
export function crearFechaBogota(fechaIso: string, hora = "00:00"): Date {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  return new Date(new TZDate(anio, mes - 1, dia, horas, minutos, ZONA).getTime());
}

/** Fecha en formato aaaa-mm-dd según la hora de Bogotá (útil para campos de formulario). */
export function aFechaIso(fecha: Date | string | number): string {
  return format(enBogota(fecha), "yyyy-MM-dd");
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) según la hora de Bogotá. */
export function diaSemanaIso(fecha: Date): number {
  const dia = enBogota(fecha).getDay();
  return dia === 0 ? 7 : dia;
}

export const nombresDiasSemana: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

/** Hora con segundos (HH:mm:ss), por ejemplo para indicar cuándo se actualizó una lista. */
export function formatearHoraConSegundos(fecha: Date | string | number): string {
  return format(enBogota(fecha), "HH:mm:ss");
}
