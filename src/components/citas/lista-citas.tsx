import Link from "next/link";
import { EstadoVacio, Insignia } from "@/components/ui/estructura";
import { estadosCita, nombreMedico } from "@/lib/etiquetas";
import { diaSemanaIso, formatearFecha, formatearHora, nombresDiasSemana } from "@/lib/fechas";
import type { CitaDetallada } from "@/servicios/agendamiento";

/** Lista de citas en tarjetas; el estado siempre se muestra con texto. */
export function ListaCitas({
  citas,
  rutaDetalle,
  vacio,
}: {
  citas: CitaDetallada[];
  rutaDetalle: (citaId: number) => string;
  vacio: string;
}) {
  if (citas.length === 0) return <EstadoVacio titulo={vacio} />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {citas.map((cita) => {
        const estado = estadosCita[cita.estado];
        return (
          <li key={cita.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">
                  {nombresDiasSemana[diaSemanaIso(cita.espacio.inicio)]}, {formatearFecha(cita.espacio.inicio)} ·{" "}
                  {formatearHora(cita.espacio.inicio)}
                </p>
                <p>{cita.especialidad.nombre}</p>
              </div>
              <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
            </div>
            <p className="mt-2 text-slate-700">
              {nombreMedico(cita.espacio.medico)} · {cita.espacio.consultorio.nombre}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Código <span className="font-mono font-semibold text-slate-800">{cita.codigo}</span>
            </p>
            <Link
              href={rutaDetalle(cita.id)}
              className="mt-3 inline-block font-semibold text-petroleo-700 underline underline-offset-4"
            >
              Ver detalle<span className="sr-only"> de la cita {cita.codigo}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
