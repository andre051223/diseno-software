import type { Prisma } from "@/generated/prisma/client";
import type { CanalOrigen } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { nombreMedico, nombresCanal } from "@/lib/etiquetas";
import { crearFechaBogota } from "@/lib/fechas";
import type { FiltrosReporte } from "@/lib/validaciones/reportes";
import { sumarDiasIso } from "./generador-espacios";

/**
 * Reportes de gestión para el director médico (RF-32 a RF-34).
 *
 * Todos los reportes toman las citas y los espacios cuya fecha de atención cae en el
 * rango indicado (fechas de Bogotá, ambos extremos incluidos).
 */

/** Porcentaje con un decimal; null cuando no hay base para calcularlo. */
export function porcentaje(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((parte / total) * 1000) / 10;
}

/** Promedio con un decimal; null cuando no hay datos. */
export function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce((acumulado, valor) => acumulado + valor, 0);
  return Math.round((suma / valores.length) * 10) / 10;
}

/** Instantes UTC que delimitan el rango de fechas de Bogotá (fin exclusivo). */
export function rangoReporte(filtros: Pick<FiltrosReporte, "desde" | "hasta">) {
  return {
    gte: crearFechaBogota(filtros.desde, "00:00"),
    lt: crearFechaBogota(sumarDiasIso(filtros.hasta, 1), "00:00"),
  };
}

function ordenarPorNombre<T extends { nombre: string }>(filas: T[]): T[] {
  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// ---------------------------------------------------------------------------
// RF-32: porcentaje de ocupación por especialidad, médico y consultorio
// ---------------------------------------------------------------------------

export type FilaOcupacion = {
  id: number;
  nombre: string;
  ofertados: number;
  ocupados: number;
  porcentaje: number | null;
};

export type ReporteOcupacion = {
  total: FilaOcupacion;
  porEspecialidad: FilaOcupacion[];
  porMedico: FilaOcupacion[];
  porConsultorio: FilaOcupacion[];
};

function filaOcupacion(id: number, nombre: string, ofertados: number, ocupados: number): FilaOcupacion {
  return { id, nombre, ofertados, ocupados, porcentaje: porcentaje(ocupados, ofertados) };
}

/**
 * RF-32: calcula la ocupación como espacios ocupados sobre espacios ofertados.
 *
 * - Se ofertan los espacios del rango que no están bloqueados por una novedad (RF-11).
 * - Un espacio está ocupado mientras una cita lo usa: agendada, confirmada, pendiente de
 *   validación, en sala, atendida o inasistencia (la inasistencia conserva el espacio, RF-31).
 * - Por especialidad, la oferta es la de los médicos asociados a ella (un médico con dos
 *   especialidades ofrece sus espacios a ambas) y la ocupación, la de las citas de esa especialidad.
 */
export async function reporteOcupacion(filtros: FiltrosReporte): Promise<ReporteOcupacion> {
  const rango = rangoReporte(filtros);
  const filtroMedico: Prisma.EspacioWhereInput = filtros.especialidad
    ? { medico: { especialidades: { some: { id: filtros.especialidad } } } }
    : {};

  const [espacios, citasOcupando, medicos, consultorios, especialidades] = await Promise.all([
    db.espacio.groupBy({
      by: ["medicoId", "consultorioId", "estado"],
      where: { inicio: rango, estado: { not: "bloqueado" }, ...filtroMedico },
      _count: { _all: true },
    }),
    db.cita.groupBy({
      by: ["especialidadId"],
      where: {
        espacioActivoId: { not: null },
        espacio: { inicio: rango, estado: "ocupado" },
        ...(filtros.especialidad ? { especialidadId: filtros.especialidad } : {}),
      },
      _count: { _all: true },
    }),
    db.medico.findMany({
      select: { id: true, nombres: true, apellidos: true, especialidades: { select: { id: true } } },
    }),
    db.consultorio.findMany({ select: { id: true, nombre: true } }),
    db.especialidad.findMany({ select: { id: true, nombre: true } }),
  ]);

  type Conteo = { ofertados: number; ocupados: number };
  const sumar = (mapa: Map<number, Conteo>, id: number, cantidad: number, ocupado: boolean) => {
    const actual = mapa.get(id) ?? { ofertados: 0, ocupados: 0 };
    actual.ofertados += cantidad;
    if (ocupado) actual.ocupados += cantidad;
    mapa.set(id, actual);
  };

  const porMedico = new Map<number, Conteo>();
  const porConsultorio = new Map<number, Conteo>();
  let ofertadosTotal = 0;
  let ocupadosTotal = 0;
  for (const grupo of espacios) {
    const cantidad = grupo._count._all;
    const ocupado = grupo.estado === "ocupado";
    sumar(porMedico, grupo.medicoId, cantidad, ocupado);
    sumar(porConsultorio, grupo.consultorioId, cantidad, ocupado);
    ofertadosTotal += cantidad;
    if (ocupado) ocupadosTotal += cantidad;
  }

  // Oferta por especialidad: la suma de la oferta de sus médicos.
  const ofertaEspecialidad = new Map<number, number>();
  const medicosPorId = new Map(medicos.map((medico) => [medico.id, medico]));
  for (const [medicoId, conteo] of porMedico) {
    for (const { id } of medicosPorId.get(medicoId)?.especialidades ?? []) {
      if (filtros.especialidad && id !== filtros.especialidad) continue;
      ofertaEspecialidad.set(id, (ofertaEspecialidad.get(id) ?? 0) + conteo.ofertados);
    }
  }
  const ocupacionEspecialidad = new Map(citasOcupando.map((grupo) => [grupo.especialidadId, grupo._count._all]));

  const filasEspecialidad = especialidades
    .filter((especialidad) => ofertaEspecialidad.has(especialidad.id) || ocupacionEspecialidad.has(especialidad.id))
    .map((especialidad) =>
      filaOcupacion(
        especialidad.id,
        especialidad.nombre,
        ofertaEspecialidad.get(especialidad.id) ?? 0,
        ocupacionEspecialidad.get(especialidad.id) ?? 0,
      ),
    );

  const filasMedico = [...porMedico].map(([id, conteo]) => {
    const medico = medicosPorId.get(id);
    return filaOcupacion(id, medico ? nombreMedico(medico) : `Médico ${id}`, conteo.ofertados, conteo.ocupados);
  });

  const nombresConsultorio = new Map(consultorios.map((consultorio) => [consultorio.id, consultorio.nombre]));
  const filasConsultorio = [...porConsultorio].map(([id, conteo]) =>
    filaOcupacion(id, nombresConsultorio.get(id) ?? `Consultorio ${id}`, conteo.ofertados, conteo.ocupados),
  );

  return {
    total: filaOcupacion(0, "Total", ofertadosTotal, ocupadosTotal),
    porEspecialidad: ordenarPorNombre(filasEspecialidad),
    porMedico: ordenarPorNombre(filasMedico),
    porConsultorio: ordenarPorNombre(filasConsultorio),
  };
}

// ---------------------------------------------------------------------------
// RF-33: inasistencias y cancelaciones por especialidad y canal
// ---------------------------------------------------------------------------

export type FilaAusentismo = {
  clave: string;
  nombre: string;
  citas: number;
  inasistencias: number;
  cancelaciones: number;
  porcentajeInasistencias: number | null;
  porcentajeCancelaciones: number | null;
};

export type ReporteAusentismo = {
  total: FilaAusentismo;
  porEspecialidad: FilaAusentismo[];
  porCanal: FilaAusentismo[];
};

type ConteoAusentismo = { citas: number; inasistencias: number; cancelaciones: number };

function filaAusentismo(clave: string, nombre: string, conteo: ConteoAusentismo): FilaAusentismo {
  return {
    clave,
    nombre,
    ...conteo,
    porcentajeInasistencias: porcentaje(conteo.inasistencias, conteo.citas),
    porcentajeCancelaciones: porcentaje(conteo.cancelaciones, conteo.citas),
  };
}

/** Filtro de citas cuya hora de atención cae en el rango, con especialidad opcional. */
function filtroCitas(filtros: FiltrosReporte): Prisma.CitaWhereInput {
  return {
    espacio: { inicio: rangoReporte(filtros) },
    ...(filtros.especialidad ? { especialidadId: filtros.especialidad } : {}),
  };
}

/**
 * RF-33: número y porcentaje de inasistencias y cancelaciones sobre el total de citas del
 * rango, agrupados por especialidad y por canal de origen (RF-19). Una cita reprogramada
 * conserva su código, así que cuenta una sola vez, con su estado final.
 */
export async function reporteAusentismo(filtros: FiltrosReporte): Promise<ReporteAusentismo> {
  const [grupos, especialidades] = await Promise.all([
    db.cita.groupBy({
      by: ["especialidadId", "canal", "estado"],
      where: filtroCitas(filtros),
      _count: { _all: true },
    }),
    db.especialidad.findMany({ select: { id: true, nombre: true } }),
  ]);

  const vacio = (): ConteoAusentismo => ({ citas: 0, inasistencias: 0, cancelaciones: 0 });
  const total = vacio();
  const porEspecialidad = new Map<number, ConteoAusentismo>();
  const porCanal = new Map<CanalOrigen, ConteoAusentismo>();

  for (const grupo of grupos) {
    const cantidad = grupo._count._all;
    const conteos = [
      total,
      porEspecialidad.get(grupo.especialidadId) ?? vacio(),
      porCanal.get(grupo.canal) ?? vacio(),
    ];
    for (const conteo of conteos) {
      conteo.citas += cantidad;
      if (grupo.estado === "inasistencia") conteo.inasistencias += cantidad;
      if (grupo.estado === "cancelada") conteo.cancelaciones += cantidad;
    }
    porEspecialidad.set(grupo.especialidadId, conteos[1]);
    porCanal.set(grupo.canal, conteos[2]);
  }

  const nombresEspecialidad = new Map(especialidades.map((especialidad) => [especialidad.id, especialidad.nombre]));
  const filasEspecialidad = [...porEspecialidad].map(([id, conteo]) =>
    filaAusentismo(String(id), nombresEspecialidad.get(id) ?? `Especialidad ${id}`, conteo),
  );
  // Los canales se listan en el orden en que se definen, no alfabético.
  const filasCanal = (Object.keys(nombresCanal) as CanalOrigen[])
    .filter((canal) => porCanal.has(canal))
    .map((canal) => filaAusentismo(canal, nombresCanal[canal], porCanal.get(canal)!));

  return {
    total: filaAusentismo("total", "Total", total),
    porEspecialidad: ordenarPorNombre(filasEspecialidad),
    porCanal: filasCanal,
  };
}

// ---------------------------------------------------------------------------
// RF-34: tiempos promedio de oportunidad y de espera
// ---------------------------------------------------------------------------

export type FilaTiempos = {
  id: number;
  nombre: string;
  /** Citas usadas para el promedio de días entre la solicitud y la cita. */
  citasSolicitud: number;
  diasPromedioSolicitud: number | null;
  /** Citas atendidas usadas para el promedio de minutos entre la llegada y la atención. */
  citasEspera: number;
  minutosPromedioEspera: number | null;
};

export type ReporteTiempos = { total: FilaTiempos; porEspecialidad: FilaTiempos[] };

const MS_DIA = 86_400_000;
const MS_MINUTO = 60_000;

/**
 * RF-34: días promedio entre la fecha de solicitud y la fecha de la cita, y minutos promedio
 * entre la llegada a recepción (RF-28) y el inicio de la atención (RF-30).
 *
 * - Los días se calculan sobre las citas asignadas (se excluyen las canceladas).
 * - Los minutos, sobre las citas con llegada e inicio de atención registrados.
 */
export async function reporteTiempos(filtros: FiltrosReporte): Promise<ReporteTiempos> {
  const [citas, especialidades] = await Promise.all([
    db.cita.findMany({
      where: { ...filtroCitas(filtros), estado: { not: "cancelada" } },
      select: {
        especialidadId: true,
        fechaSolicitud: true,
        horaLlegada: true,
        inicioAtencion: true,
        espacio: { select: { inicio: true } },
      },
    }),
    db.especialidad.findMany({ select: { id: true, nombre: true } }),
  ]);

  type Valores = { dias: number[]; minutos: number[] };
  const total: Valores = { dias: [], minutos: [] };
  const porEspecialidad = new Map<number, Valores>();

  for (const cita of citas) {
    const valores = porEspecialidad.get(cita.especialidadId) ?? { dias: [], minutos: [] };
    porEspecialidad.set(cita.especialidadId, valores);
    const dias = (cita.espacio.inicio.getTime() - cita.fechaSolicitud.getTime()) / MS_DIA;
    total.dias.push(dias);
    valores.dias.push(dias);
    if (cita.horaLlegada && cita.inicioAtencion) {
      const minutos = Math.max(0, (cita.inicioAtencion.getTime() - cita.horaLlegada.getTime()) / MS_MINUTO);
      total.minutos.push(minutos);
      valores.minutos.push(minutos);
    }
  }

  const fila = (id: number, nombre: string, valores: Valores): FilaTiempos => ({
    id,
    nombre,
    citasSolicitud: valores.dias.length,
    diasPromedioSolicitud: promedio(valores.dias),
    citasEspera: valores.minutos.length,
    minutosPromedioEspera: promedio(valores.minutos),
  });

  const nombresEspecialidad = new Map(especialidades.map((especialidad) => [especialidad.id, especialidad.nombre]));
  return {
    total: fila(0, "Total", total),
    porEspecialidad: ordenarPorNombre(
      [...porEspecialidad].map(([id, valores]) =>
        fila(id, nombresEspecialidad.get(id) ?? `Especialidad ${id}`, valores),
      ),
    ),
  };
}
