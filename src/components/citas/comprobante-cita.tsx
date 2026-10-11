import { Insignia } from "@/components/ui/estructura";
import { estadosCita, nombreMedico, nombrePaciente, nombresCanal, nombresResultadoCobertura } from "@/lib/etiquetas";
import { diaSemanaIso, formatearFecha, formatearFechaHora, formatearHora, nombresDiasSemana } from "@/lib/fechas";
import type { CitaDetallada } from "@/servicios/agendamiento";

/**
 * RF-15: comprobante imprimible con el código único, la fecha, la hora, el médico,
 * la especialidad y el consultorio de la cita.
 */
export function ComprobanteCita({ cita }: { cita: CitaDetallada }) {
  const { espacio, paciente } = cita;
  const estado = estadosCita[cita.estado];
  const cobertura = cita.esParticular
    ? "Particular"
    : cita.resultadoCobertura
      ? `${paciente.aseguradora.nombre}: ${nombresResultadoCobertura[cita.resultadoCobertura].toLowerCase()}`
      : paciente.aseguradora.nombre;

  const filas: [string, string][] = [
    ["Paciente", nombrePaciente(paciente)],
    ["Documento", `${paciente.tipoDocumento} ${paciente.numeroDocumento}`],
    ["Fecha", `${nombresDiasSemana[diaSemanaIso(espacio.inicio)]}, ${formatearFecha(espacio.inicio)}`],
    ["Hora", formatearHora(espacio.inicio)],
    ["Especialidad", cita.especialidad.nombre],
    ["Médico", nombreMedico(espacio.medico)],
    ["Consultorio", `${espacio.consultorio.nombre} (${espacio.consultorio.ubicacion})`],
    ["Cobertura", cobertura],
    ["Canal de solicitud", nombresCanal[cita.canal]],
    ["Fecha de solicitud", formatearFechaHora(cita.fechaSolicitud)],
  ];

  return (
    <article
      aria-labelledby="titulo-comprobante"
      className="rounded-xl border-2 border-petroleo-700 bg-white p-4 shadow-sm sm:p-6 print:border print:shadow-none"
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-petroleo-700">Hospital Central San Rafael</p>
          <h2 id="titulo-comprobante" className="text-xl font-bold">
            Comprobante de cita
          </h2>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-slate-600">Código de la cita</p>
          <p className="font-mono text-2xl font-bold tracking-wider text-petroleo-900" data-codigo-cita>
            {cita.codigo}
          </p>
        </div>
      </header>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-sm font-medium text-slate-600">{etiqueta}</dt>
            <dd className="text-lg">{valor}</dd>
          </div>
        ))}
        <div>
          <dt className="text-sm font-medium text-slate-600">Estado</dt>
          <dd className="mt-1">
            <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
          </dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-700">
        Preséntese con anticipación y con su documento de identidad. En recepción puede registrar su llegada con el código
        de la cita o su número de documento.
      </p>
    </article>
  );
}
