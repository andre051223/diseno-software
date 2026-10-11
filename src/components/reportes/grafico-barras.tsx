"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatearDecimal } from "@/lib/formato";

/**
 * Colores de las series, validados para daltonismo y contraste sobre fondo blanco.
 * El orden es fijo: la primera serie siempre usa el azul petróleo y la segunda, el naranja.
 */
export const coloresSeries = ["#008a9e", "#c2410c"] as const;

export type SerieGrafico = { clave: string; nombre: string };

type Propiedades = {
  /** Descripción breve del gráfico para lectores de pantalla. */
  descripcion: string;
  datos: Record<string, string | number | null>[];
  series: SerieGrafico[];
  /** Sufijo de las cifras, por ejemplo « %» o « días». */
  unidad: string;
  /** Máximo del eje; para porcentajes, 100. */
  maximo?: number;
};

/**
 * Gráfico de barras horizontales para los reportes de gestión (RF-32 a RF-34).
 * Las cifras exactas se leen en la tabla que acompaña a cada gráfico.
 */
export function GraficoBarras({ descripcion, datos, series, unidad, maximo }: Propiedades) {
  const altoPorFila = series.length * 14 + 18;
  const alto = Math.max(180, datos.length * altoPorFila + (series.length > 1 ? 70 : 40));
  const formatear = (valor: unknown) => `${formatearDecimal(typeof valor === "number" ? valor : null)}${unidad}`;

  return (
    <figure className="m-0" aria-label={descripcion}>
      <div style={{ height: alto }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={[0, maximo ?? "auto"]}
              tickFormatter={(valor: number) => `${formatearDecimal(valor).replace(/,0$/, "")}${unidad}`}
              tick={{ fill: "#475569", fontSize: 12 }}
              stroke="#94a3b8"
            />
            <YAxis
              type="category"
              dataKey="nombre"
              width={128}
              interval={0}
              tick={{ fill: "#1e293b", fontSize: 12 }}
              stroke="#94a3b8"
            />
            <Tooltip
              formatter={(valor, nombre) => [formatear(valor), nombre]}
              cursor={{ fill: "#eef6f7" }}
              contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1", color: "#0f172a" }}
            />
            {series.length > 1 ? <Legend wrapperStyle={{ color: "#1e293b", fontSize: 14 }} /> : null}
            {series.map((serie, indice) => (
              <Bar
                key={serie.clave}
                dataKey={serie.clave}
                name={serie.nombre}
                fill={coloresSeries[indice]}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-sm text-slate-600">
        Pase el puntero o toque una barra para ver la cifra. La tabla siguiente presenta los mismos datos.
      </figcaption>
    </figure>
  );
}
