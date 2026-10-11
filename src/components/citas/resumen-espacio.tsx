import { nombreMedico } from "@/lib/etiquetas";
import { diaSemanaIso, formatearFecha, formatearHora, nombresDiasSemana } from "@/lib/fechas";

/** Datos principales de un horario: fecha, hora, médico, especialidad y consultorio. */
export function ResumenEspacio({
  espacio,
  especialidad,
  paciente,
}: {
  espacio: {
    inicio: Date;
    fin: Date;
    medico: { nombres: string; apellidos: string };
    consultorio: { nombre: string; ubicacion: string };
  };
  especialidad: string;
  paciente?: string;
}) {
  const filas: [string, string][] = [
    ...(paciente ? ([["Paciente", paciente]] as [string, string][]) : []),
    ["Fecha", `${nombresDiasSemana[diaSemanaIso(espacio.inicio)]}, ${formatearFecha(espacio.inicio)}`],
    ["Hora", `${formatearHora(espacio.inicio)} a ${formatearHora(espacio.fin)}`],
    ["Especialidad", especialidad],
    ["Médico", nombreMedico(espacio.medico)],
    ["Consultorio", `${espacio.consultorio.nombre} (${espacio.consultorio.ubicacion})`],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt className="text-sm font-medium text-slate-600">{etiqueta}</dt>
          <dd className="text-lg">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
