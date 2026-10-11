import { z } from "zod";
import "@/lib/validaciones/idioma";
import { aFechaIso } from "@/lib/fechas";
import { sumarDiasIso } from "@/servicios/generador-espacios";

/** Días máximos del rango de los reportes (un año). */
export const diasMaximosReporte = 366;

/** Días que cubre el rango por defecto: los últimos 30 días hasta hoy. */
const diasRangoInicial = 30;

/** Tipos de reporte que se pueden exportar (RF-35). */
export const tiposReporte = ["ocupacion", "ausentismo", "tiempos"] as const;
export type TipoReporte = (typeof tiposReporte)[number];

export const formatosExportacion = ["csv", "pdf"] as const;
export type FormatoExportacion = (typeof formatosExportacion)[number];

// ---------------------------------------------------------------------------
// RF-32 a RF-35: filtros comunes a los reportes de gestión
// ---------------------------------------------------------------------------

export const esquemaFiltrosReporte = z
  .object({
    desde: z.iso.date("Escriba una fecha inicial válida."),
    hasta: z.iso.date("Escriba una fecha final válida."),
    especialidad: z
      .string()
      .optional()
      .transform((valor) => (valor ? Number(valor) : undefined))
      .pipe(z.number("Seleccione una especialidad válida.").int().positive().optional()),
  })
  .superRefine((datos, contexto) => {
    if (datos.hasta < datos.desde) {
      contexto.addIssue({
        code: "custom",
        path: ["hasta"],
        message: "La fecha final debe ser igual o posterior a la inicial.",
      });
      return;
    }
    const dias = (Date.parse(datos.hasta) - Date.parse(datos.desde)) / 86_400_000;
    if (dias > diasMaximosReporte) {
      contexto.addIssue({
        code: "custom",
        path: ["hasta"],
        message: `El rango no puede superar ${diasMaximosReporte} días.`,
      });
    }
  });

export type FiltrosReporte = z.infer<typeof esquemaFiltrosReporte>;

/** Rango por defecto de los reportes: los últimos 30 días, hoy incluido. */
export function filtrosIniciales(ahora: Date = new Date()): { desde: string; hasta: string } {
  const hoy = aFechaIso(ahora);
  return { desde: sumarDiasIso(hoy, -diasRangoInicial), hasta: hoy };
}

/**
 * Lee los filtros desde los parámetros de la URL. Si no llega una fecha se usa el rango
 * por defecto, para que el tablero muestre datos desde la primera visita.
 */
export function leerFiltrosReporte(
  parametros: Record<string, string | string[] | undefined>,
  ahora: Date = new Date(),
) {
  const texto = (clave: string) => {
    const valor = parametros[clave];
    return typeof valor === "string" ? valor.trim() : undefined;
  };
  const iniciales = filtrosIniciales(ahora);
  const datos = {
    desde: texto("desde") || iniciales.desde,
    hasta: texto("hasta") || iniciales.hasta,
    especialidad: texto("especialidad") || undefined,
  };
  return { datos, resultado: esquemaFiltrosReporte.safeParse(datos) };
}
