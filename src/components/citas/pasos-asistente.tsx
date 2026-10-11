const PASOS_NUEVA = ["Especialidad", "Médico y fecha", "Horario", "Validación de cobertura", "Confirmación"];
const PASOS_REPROGRAMAR = ["Médico y fecha", "Horario", "Confirmación"];

/** Indicador de pasos del asistente de agendamiento; el paso actual se anuncia con texto. */
export function PasosAsistente({ actual, modo = "nueva" }: { actual: number; modo?: "nueva" | "reprogramar" }) {
  const pasos = modo === "nueva" ? PASOS_NUEVA : PASOS_REPROGRAMAR;
  return (
    <nav aria-label="Pasos del agendamiento" className="mb-6 no-imprimir">
      <p className="mb-2 font-medium text-slate-700">
        Paso {actual} de {pasos.length}: {pasos[actual - 1]}
      </p>
      <ol className="flex flex-wrap gap-2">
        {pasos.map((paso, indice) => {
          const numero = indice + 1;
          const estado = numero < actual ? "hecho" : numero === actual ? "actual" : "pendiente";
          return (
            <li
              key={paso}
              aria-current={estado === "actual" ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                estado === "actual"
                  ? "border-petroleo-700 bg-petroleo-700 font-semibold text-white"
                  : estado === "hecho"
                    ? "border-petroleo-300 bg-petroleo-50 text-petroleo-900"
                    : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <span aria-hidden="true">{estado === "hecho" ? "✓" : numero}</span>
              {paso}
              {estado === "hecho" ? <span className="sr-only"> (completado)</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
