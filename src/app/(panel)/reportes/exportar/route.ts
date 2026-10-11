import type { NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/sesion";
import {
  formatosExportacion,
  leerFiltrosReporte,
  tiposReporte,
  type FormatoExportacion,
  type TipoReporte,
} from "@/lib/validaciones/reportes";
import { armarDocumentoReporte } from "@/servicios/documentos-reporte";
import { generarCsv, generarPdf } from "@/servicios/exportacion-reportes";

function texto(mensaje: string, status: number) {
  return new Response(mensaje, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * RF-35: descarga un reporte en CSV o PDF con los filtros aplicados en el tablero.
 * Parámetros: `reporte` (ocupacion, ausentismo o tiempos), `formato` (csv o pdf),
 * `desde`, `hasta` y `especialidad` (opcional).
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return texto("Inicie sesión para descargar el reporte.", 401);
  if (usuario.rol !== "director_medico") return texto("No tiene permiso para descargar reportes.", 403);

  const parametros = Object.fromEntries(request.nextUrl.searchParams);
  const reporte = parametros.reporte as TipoReporte;
  const formato = parametros.formato as FormatoExportacion;
  if (!tiposReporte.includes(reporte) || !formatosExportacion.includes(formato)) {
    return texto("El reporte o el formato solicitado no existe.", 400);
  }
  const { resultado } = leerFiltrosReporte(parametros);
  if (!resultado.success) {
    return texto(`Los filtros no son válidos: ${resultado.error.issues.map((issue) => issue.message).join(" ")}`, 400);
  }

  const filtros = resultado.data;
  const documento = await armarDocumentoReporte(reporte, filtros);
  const nombre = `reporte-${reporte}-${filtros.desde}-a-${filtros.hasta}.${formato}`;
  const encabezados = {
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "no-store",
  };

  if (formato === "csv") {
    return new Response(generarCsv(documento), {
      headers: { ...encabezados, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const pdf = await generarPdf(documento);
  return new Response(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
    headers: { ...encabezados, "Content-Type": "application/pdf" },
  });
}
