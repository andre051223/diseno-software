import type { Metadata } from "next";
import type { ReactNode } from "react";
import { z } from "zod";
import "@/lib/validaciones/idioma";
import { GraficoBarras } from "@/components/reportes/grafico-barras";
import { TablaReporteVista } from "@/components/reportes/tabla-reporte";
import { Alerta } from "@/components/ui/alerta";
import { clasesBoton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { EncabezadoPagina, EstadoVacio, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { crearFechaBogota, formatearFecha } from "@/lib/fechas";
import { formatearDecimal, formatearEntero, formatearPorcentaje } from "@/lib/formato";
import { requerirRol } from "@/lib/sesion";
import { leerFiltrosReporte, type FiltrosReporte, type TipoReporte } from "@/lib/validaciones/reportes";
import {
  notasReporte,
  tablasAusentismo,
  tablasOcupacion,
  tablasTiempos,
  titulosReporte,
} from "@/servicios/documentos-reporte";
import { reporteAusentismo, reporteOcupacion, reporteTiempos } from "@/servicios/reportes";

export const metadata: Metadata = { title: "Reportes" };

/** Parámetros de la URL que reproducen los filtros aplicados (RF-35). */
function consultaFiltros(filtros: FiltrosReporte) {
  const consulta = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  if (filtros.especialidad) consulta.set("especialidad", String(filtros.especialidad));
  return consulta;
}

/** RF-35: enlaces de descarga en CSV y PDF con los filtros aplicados. */
function EnlacesExportacion({ tipo, filtros }: { tipo: TipoReporte; filtros: FiltrosReporte }) {
  const enlace = (formato: "csv" | "pdf") => {
    const consulta = consultaFiltros(filtros);
    consulta.set("reporte", tipo);
    consulta.set("formato", formato);
    return `/reportes/exportar?${consulta.toString()}`;
  };
  const titulo = titulosReporte[tipo].titulo.toLowerCase();
  return (
    <div className="flex flex-wrap gap-2 no-imprimir">
      <a href={enlace("csv")} download className={clasesBoton("secundario")} aria-label={`Descargar ${titulo} en CSV`}>
        Descargar CSV
      </a>
      <a href={enlace("pdf")} download className={clasesBoton("secundario")} aria-label={`Descargar ${titulo} en PDF`}>
        Descargar PDF
      </a>
    </div>
  );
}

function SeccionReporte({
  tipo,
  filtros,
  children,
}: {
  tipo: TipoReporte;
  filtros: FiltrosReporte;
  children: ReactNode;
}) {
  const { titulo, requisito } = titulosReporte[tipo];
  return (
    <Tarjeta className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{titulo}</h2>
          <p className="text-sm text-slate-600">{requisito}</p>
        </div>
        <EnlacesExportacion tipo={tipo} filtros={filtros} />
      </div>
      {children}
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {notasReporte[tipo].map((nota) => (
          <li key={nota}>{nota}</li>
        ))}
      </ul>
    </Tarjeta>
  );
}

/** Indicador destacado del tablero. */
function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-sm font-medium text-slate-700">{etiqueta}</dt>
      <dd className="mt-1 text-3xl font-bold text-petroleo-900 tabular-nums">{valor}</dd>
      <dd className="mt-1 text-sm text-slate-600">{detalle}</dd>
    </div>
  );
}

// RF-32 a RF-35: tablero de reportes del director médico con filtros, gráficos y exportación.
export default async function PaginaReportes({ searchParams }: PageProps<"/reportes">) {
  await requerirRol("director_medico");
  const { datos, resultado } = leerFiltrosReporte(await searchParams);
  const especialidades = await db.especialidad.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } });
  const errores = resultado.success ? undefined : z.flattenError(resultado.error).fieldErrors;

  const formulario = (
    <form
      aria-label="Filtros de los reportes"
      className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end no-imprimir"
    >
      <Campo nombre="desde" etiqueta="Desde" type="date" required defaultValue={datos.desde} errores={errores?.desde} />
      <Campo nombre="hasta" etiqueta="Hasta" type="date" required defaultValue={datos.hasta} errores={errores?.hasta} />
      <Selector
        nombre="especialidad"
        etiqueta="Especialidad"
        textoVacio="Todas las especialidades"
        opciones={especialidades.map((especialidad) => ({ valor: especialidad.id, etiqueta: especialidad.nombre }))}
        defaultValue={datos.especialidad ?? ""}
        errores={errores?.especialidad}
      />
      <button type="submit" className={clasesBoton("primario")}>
        Aplicar filtros
      </button>
    </form>
  );

  const encabezado = (
    <EncabezadoPagina
      titulo="Reportes de gestión"
      descripcion="Ocupación de la agenda, inasistencias, cancelaciones y tiempos de espera según la fecha de las citas."
    />
  );

  if (!resultado.success) {
    return (
      <>
        {encabezado}
        {formulario}
        <Alerta tipo="error" titulo="No se pudieron generar los reportes">
          Revise las fechas y la especialidad seleccionadas.
        </Alerta>
      </>
    );
  }

  const filtros = resultado.data;
  const [ocupacion, ausentismo, tiempos] = await Promise.all([
    reporteOcupacion(filtros),
    reporteAusentismo(filtros),
    reporteTiempos(filtros),
  ]);
  const nombreEspecialidad = especialidades.find((especialidad) => especialidad.id === filtros.especialidad)?.nombre;
  const sinDatos = ocupacion.total.ofertados === 0 && ausentismo.total.citas === 0;
  const datosAusentismo = (filas: typeof ausentismo.porEspecialidad) =>
    filas.map((fila) => ({
      nombre: fila.nombre,
      inasistencias: fila.porcentajeInasistencias,
      cancelaciones: fila.porcentajeCancelaciones,
    }));
  const seriesAusentismo = [
    { clave: "inasistencias", nombre: "% inasistencias" },
    { clave: "cancelaciones", nombre: "% cancelaciones" },
  ];

  return (
    <>
      {encabezado}
      {formulario}

      <p className="mb-6 text-slate-700" aria-live="polite">
        Periodo del {formatearFecha(crearFechaBogota(filtros.desde))} al {formatearFecha(crearFechaBogota(filtros.hasta))}
        {nombreEspecialidad ? ` · ${nombreEspecialidad}` : " · Todas las especialidades"}.
      </p>

      {sinDatos ? (
        <EstadoVacio titulo="No hay citas ni espacios en el periodo seleccionado">
          Amplíe el rango de fechas o elija otra especialidad.
        </EstadoVacio>
      ) : (
        <div className="space-y-8">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador
              etiqueta="Ocupación"
              valor={formatearPorcentaje(ocupacion.total.porcentaje)}
              detalle={`${formatearEntero(ocupacion.total.ocupados)} de ${formatearEntero(ocupacion.total.ofertados)} espacios`}
            />
            <Indicador
              etiqueta="Inasistencias"
              valor={formatearPorcentaje(ausentismo.total.porcentajeInasistencias)}
              detalle={`${formatearEntero(ausentismo.total.inasistencias)} de ${formatearEntero(ausentismo.total.citas)} citas`}
            />
            <Indicador
              etiqueta="Cancelaciones"
              valor={formatearPorcentaje(ausentismo.total.porcentajeCancelaciones)}
              detalle={`${formatearEntero(ausentismo.total.cancelaciones)} de ${formatearEntero(ausentismo.total.citas)} citas`}
            />
            <Indicador
              etiqueta="Espera promedio"
              valor={`${formatearDecimal(tiempos.total.diasPromedioSolicitud)} días`}
              detalle={`${formatearDecimal(tiempos.total.minutosPromedioEspera)} min entre llegada y atención`}
            />
          </dl>

          {/* RF-32 */}
          <SeccionReporte tipo="ocupacion" filtros={filtros}>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Ocupación por especialidad</h3>
              <GraficoBarras
                descripcion="Gráfico de barras del porcentaje de ocupación por especialidad"
                datos={ocupacion.porEspecialidad.map((fila) => ({ nombre: fila.nombre, ocupacion: fila.porcentaje }))}
                series={[{ clave: "ocupacion", nombre: "Ocupación" }]}
                unidad=" %"
                maximo={100}
              />
            </div>
            {tablasOcupacion(ocupacion).map((tabla) => (
              <TablaReporteVista key={tabla.titulo} tabla={tabla} contexto="Ocupación" />
            ))}
          </SeccionReporte>

          {/* RF-33 */}
          <SeccionReporte tipo="ausentismo" filtros={filtros}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-lg font-semibold">Por especialidad</h3>
                <GraficoBarras
                  descripcion="Gráfico de barras del porcentaje de inasistencias y cancelaciones por especialidad"
                  datos={datosAusentismo(ausentismo.porEspecialidad)}
                  series={seriesAusentismo}
                  unidad=" %"
                />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Por canal de origen</h3>
                <GraficoBarras
                  descripcion="Gráfico de barras del porcentaje de inasistencias y cancelaciones por canal de origen"
                  datos={datosAusentismo(ausentismo.porCanal)}
                  series={seriesAusentismo}
                  unidad=" %"
                />
              </div>
            </div>
            {tablasAusentismo(ausentismo).map((tabla) => (
              <TablaReporteVista key={tabla.titulo} tabla={tabla} contexto="Inasistencias y cancelaciones" />
            ))}
          </SeccionReporte>

          {/* RF-34 */}
          <SeccionReporte tipo="tiempos" filtros={filtros}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-lg font-semibold">Días promedio entre solicitud y cita</h3>
                <GraficoBarras
                  descripcion="Gráfico de barras de los días promedio entre la solicitud y la cita por especialidad"
                  datos={tiempos.porEspecialidad.map((fila) => ({ nombre: fila.nombre, dias: fila.diasPromedioSolicitud }))}
                  series={[{ clave: "dias", nombre: "Días promedio" }]}
                  unidad=" días"
                />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Minutos promedio entre llegada y atención</h3>
                <GraficoBarras
                  descripcion="Gráfico de barras de los minutos promedio entre la llegada y el inicio de la atención por especialidad"
                  datos={tiempos.porEspecialidad.map((fila) => ({ nombre: fila.nombre, minutos: fila.minutosPromedioEspera }))}
                  series={[{ clave: "minutos", nombre: "Minutos promedio" }]}
                  unidad=" min"
                />
              </div>
            </div>
            {tablasTiempos(tiempos).map((tabla) => (
              <TablaReporteVista key={tabla.titulo} tabla={tabla} contexto="Tiempos" />
            ))}
          </SeccionReporte>
        </div>
      )}
    </>
  );
}
