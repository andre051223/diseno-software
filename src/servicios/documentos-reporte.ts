import { db } from "@/lib/db";
import { crearFechaBogota, formatearFecha } from "@/lib/fechas";
import { formatearDecimal, formatearEntero, formatearPorcentaje } from "@/lib/formato";
import type { FiltrosReporte, TipoReporte } from "@/lib/validaciones/reportes";
import {
  reporteAusentismo,
  reporteOcupacion,
  reporteTiempos,
  type FilaAusentismo,
  type FilaOcupacion,
  type FilaTiempos,
  type ReporteAusentismo,
  type ReporteOcupacion,
  type ReporteTiempos,
} from "./reportes";

/**
 * Representación tabular de cada reporte. La misma estructura alimenta las tablas del
 * tablero y los archivos exportados (RF-35), para que siempre muestren las mismas cifras.
 */
export type TablaReporte = {
  titulo: string;
  columnas: string[];
  filas: string[][];
  /** Fila de totales, opcional. */
  total?: string[];
};

export type DocumentoReporte = {
  titulo: string;
  requisito: string;
  /** Filtros aplicados en texto legible, por ejemplo «Desde: 01/10/2026». */
  filtros: string[];
  tablas: TablaReporte[];
  notas: string[];
};

export const titulosReporte: Record<TipoReporte, { titulo: string; requisito: string }> = {
  ocupacion: { titulo: "Ocupación de la agenda", requisito: "RF-32" },
  ausentismo: { titulo: "Inasistencias y cancelaciones", requisito: "RF-33" },
  tiempos: { titulo: "Tiempos de oportunidad y de espera", requisito: "RF-34" },
};

export const notasReporte: Record<TipoReporte, string[]> = {
  ocupacion: [
    "Ocupación = espacios con cita (agendada, confirmada, pendiente de validación, en sala, atendida o inasistencia) sobre espacios ofertados.",
    "No se ofertan los espacios bloqueados por novedades del médico. Un médico con dos especialidades ofrece sus espacios a ambas.",
  ],
  ausentismo: [
    "Porcentajes calculados sobre el total de citas del rango, según la fecha de la cita. Una cita reprogramada cuenta una sola vez.",
  ],
  tiempos: [
    "Días entre la solicitud y la cita: citas asignadas del rango, sin las canceladas.",
    "Minutos entre la llegada y el inicio de la atención: citas con ambos registros.",
  ],
};

// ---------------------------------------------------------------------------
// Conversión de cada reporte a tablas
// ---------------------------------------------------------------------------

const columnasOcupacion = (primera: string) => [primera, "Espacios ofertados", "Espacios ocupados", "Ocupación"];

function celdasOcupacion(fila: FilaOcupacion): string[] {
  return [fila.nombre, formatearEntero(fila.ofertados), formatearEntero(fila.ocupados), formatearPorcentaje(fila.porcentaje)];
}

export function tablasOcupacion(reporte: ReporteOcupacion): TablaReporte[] {
  const total = celdasOcupacion(reporte.total);
  return [
    { titulo: "Por especialidad", columnas: columnasOcupacion("Especialidad"), filas: reporte.porEspecialidad.map(celdasOcupacion) },
    { titulo: "Por médico", columnas: columnasOcupacion("Médico"), filas: reporte.porMedico.map(celdasOcupacion), total },
    { titulo: "Por consultorio", columnas: columnasOcupacion("Consultorio"), filas: reporte.porConsultorio.map(celdasOcupacion), total },
  ];
}

const columnasAusentismo = (primera: string) => [
  primera,
  "Citas",
  "Inasistencias",
  "% inasistencias",
  "Cancelaciones",
  "% cancelaciones",
];

function celdasAusentismo(fila: FilaAusentismo): string[] {
  return [
    fila.nombre,
    formatearEntero(fila.citas),
    formatearEntero(fila.inasistencias),
    formatearPorcentaje(fila.porcentajeInasistencias),
    formatearEntero(fila.cancelaciones),
    formatearPorcentaje(fila.porcentajeCancelaciones),
  ];
}

export function tablasAusentismo(reporte: ReporteAusentismo): TablaReporte[] {
  const total = celdasAusentismo(reporte.total);
  return [
    { titulo: "Por especialidad", columnas: columnasAusentismo("Especialidad"), filas: reporte.porEspecialidad.map(celdasAusentismo), total },
    { titulo: "Por canal de origen", columnas: columnasAusentismo("Canal"), filas: reporte.porCanal.map(celdasAusentismo), total },
  ];
}

function celdasTiempos(fila: FilaTiempos): string[] {
  return [
    fila.nombre,
    formatearEntero(fila.citasSolicitud),
    formatearDecimal(fila.diasPromedioSolicitud),
    formatearEntero(fila.citasEspera),
    formatearDecimal(fila.minutosPromedioEspera),
  ];
}

export function tablasTiempos(reporte: ReporteTiempos): TablaReporte[] {
  return [
    {
      titulo: "Por especialidad",
      columnas: [
        "Especialidad",
        "Citas asignadas",
        "Días promedio entre solicitud y cita",
        "Citas atendidas con llegada",
        "Minutos promedio entre llegada y atención",
      ],
      filas: reporte.porEspecialidad.map(celdasTiempos),
      total: celdasTiempos(reporte.total),
    },
  ];
}

// ---------------------------------------------------------------------------
// Documento completo para exportar (RF-35)
// ---------------------------------------------------------------------------

/** Filtros aplicados en texto, para el encabezado de los archivos exportados. */
export async function describirFiltros(filtros: FiltrosReporte): Promise<string[]> {
  const especialidad = filtros.especialidad
    ? await db.especialidad.findUnique({ where: { id: filtros.especialidad }, select: { nombre: true } })
    : null;
  return [
    `Desde: ${formatearFecha(crearFechaBogota(filtros.desde))}`,
    `Hasta: ${formatearFecha(crearFechaBogota(filtros.hasta))}`,
    `Especialidad: ${especialidad?.nombre ?? "Todas"}`,
  ];
}

/** RF-35: arma el reporte indicado con los filtros aplicados, listo para CSV o PDF. */
export async function armarDocumentoReporte(tipo: TipoReporte, filtros: FiltrosReporte): Promise<DocumentoReporte> {
  const [descripcionFiltros, tablas] = await Promise.all([
    describirFiltros(filtros),
    tipo === "ocupacion"
      ? reporteOcupacion(filtros).then(tablasOcupacion)
      : tipo === "ausentismo"
        ? reporteAusentismo(filtros).then(tablasAusentismo)
        : reporteTiempos(filtros).then(tablasTiempos),
  ]);
  return { ...titulosReporte[tipo], filtros: descripcionFiltros, tablas, notas: notasReporte[tipo] };
}
