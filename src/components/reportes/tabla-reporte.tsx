import { ContenedorTabla, EstadoVacio, clasesCeldaTabla, clasesEncabezadoTabla } from "@/components/ui/estructura";
import type { TablaReporte } from "@/servicios/documentos-reporte";

/** Tabla de un reporte de gestión; es la misma información que se exporta (RF-35). */
export function TablaReporteVista({ tabla, contexto }: { tabla: TablaReporte; contexto: string }) {
  const etiqueta = `${contexto}: ${tabla.titulo.toLowerCase()}`;
  return (
    <div>
      <h3 className="mb-2 text-lg font-semibold">{tabla.titulo}</h3>
      {tabla.filas.length === 0 ? (
        <EstadoVacio titulo="No hay datos para los filtros aplicados" />
      ) : (
        <ContenedorTabla etiqueta={etiqueta}>
          <thead>
            <tr>
              {tabla.columnas.map((columna, indice) => (
                <th
                  key={columna}
                  scope="col"
                  className={`${clasesEncabezadoTabla} ${indice === 0 ? "" : "text-right"}`}
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, posicion) => (
              <tr key={`${posicion}-${fila[0]}`}>
                {fila.map((celda, indice) =>
                  indice === 0 ? (
                    <th key={indice} scope="row" className={`${clasesCeldaTabla} text-left font-medium`}>
                      {celda}
                    </th>
                  ) : (
                    <td key={indice} className={`${clasesCeldaTabla} text-right tabular-nums`}>
                      {celda}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
          {tabla.total ? (
            <tfoot>
              <tr className="bg-petroleo-50 font-semibold">
                {tabla.total.map((celda, indice) =>
                  indice === 0 ? (
                    <th key={indice} scope="row" className="px-4 py-3 text-left">
                      {celda}
                    </th>
                  ) : (
                    <td key={indice} className="px-4 py-3 text-right tabular-nums">
                      {celda}
                    </td>
                  ),
                )}
              </tr>
            </tfoot>
          ) : null}
        </ContenedorTabla>
      )}
    </div>
  );
}
