import { configuracion } from "@/lib/configuracion";
import { aFechaIso, crearFechaBogota, diaSemanaIso } from "@/lib/fechas";

export type BloqueDisponibilidad = {
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number;
  /** HH:mm en hora de Bogotá. */
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
};

export type IntervaloEspacio = { inicio: Date; fin: Date };

/** Suma días a una fecha aaaa-mm-dd sin depender de la zona horaria del servidor. */
export function sumarDiasIso(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function minutosDelDia(hora: string): number {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function horaDesdeMinutos(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * RF-10: calcula los espacios de un bloque de disponibilidad semanal entre dos fechas
 * (ambas incluidas, en días de Bogotá). Solo genera espacios completos: si el último
 * no cabe antes de la hora de fin, se descarta.
 */
export function calcularEspacios(
  bloque: BloqueDisponibilidad,
  desde: Date,
  hasta: Date,
): IntervaloEspacio[] {
  const espacios: IntervaloEspacio[] = [];
  const inicioMin = minutosDelDia(bloque.horaInicio);
  const finMin = minutosDelDia(bloque.horaFin);
  if (bloque.duracionMinutos <= 0 || finMin <= inicioMin) return espacios;

  const ultimoDia = aFechaIso(hasta);
  for (let dia = aFechaIso(desde); dia <= ultimoDia; dia = sumarDiasIso(dia, 1)) {
    const referencia = crearFechaBogota(dia, "12:00");
    if (diaSemanaIso(referencia) !== bloque.diaSemana) continue;

    for (let minuto = inicioMin; minuto + bloque.duracionMinutos <= finMin; minuto += bloque.duracionMinutos) {
      espacios.push({
        inicio: crearFechaBogota(dia, horaDesdeMinutos(minuto)),
        fin: crearFechaBogota(dia, horaDesdeMinutos(minuto + bloque.duracionMinutos)),
      });
    }
  }
  return espacios;
}

/** Indica si dos intervalos se solapan (los extremos que solo se tocan no cuentan). */
export function seSolapan(a: IntervaloEspacio, b: IntervaloEspacio): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** RF-10: último instante de la ventana de generación (hoy más ocho semanas, hora de Bogotá). */
export function finVentanaGeneracion(ahora: Date): Date {
  return crearFechaBogota(sumarDiasIso(aFechaIso(ahora), configuracion.semanasGeneracionEspacios * 7), "23:59");
}

/**
 * RF-10: separa los espacios candidatos que se pueden crear de los que se cruzan con
 * espacios ya existentes (del mismo consultorio o del mismo médico) o entre sí.
 * Ambas listas deben venir en el mismo marco de tiempo; el resultado conserva el orden.
 */
export function separarSolapados<T extends IntervaloEspacio>(
  candidatos: T[],
  existentes: IntervaloEspacio[],
): { aceptados: T[]; omitidos: T[] } {
  const aceptados: T[] = [];
  const omitidos: T[] = [];

  for (const candidato of candidatos) {
    const choca =
      existentes.some((existente) => seSolapan(candidato, existente)) ||
      aceptados.some((aceptado) => seSolapan(candidato, aceptado));
    (choca ? omitidos : aceptados).push(candidato);
  }
  return { aceptados, omitidos };
}
