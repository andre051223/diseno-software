import { ContenedorTabla, EstadoVacio, clasesCeldaTabla, clasesEncabezadoTabla } from "@/components/ui/estructura";
import { nombresTipoDocumento } from "@/lib/etiquetas";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import type { CambioContacto } from "@/servicios/pacientes";
import type { TipoDocumento } from "@/generated/prisma/enums";

/** Datos de identificación del paciente (solo lectura). */
export function DatosIdentificacion({
  paciente,
}: {
  paciente: {
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    fechaNacimiento: Date;
    aseguradora: { nombre: string };
  };
}) {
  const filas = [
    ["Documento", `${nombresTipoDocumento[paciente.tipoDocumento]} ${paciente.numeroDocumento}`],
    ["Nombres", paciente.nombres],
    ["Apellidos", paciente.apellidos],
    ["Fecha de nacimiento", formatearFecha(paciente.fechaNacimiento)],
    ["Aseguradora", paciente.aseguradora.nombre],
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

function Valor({ anterior, nuevo }: { anterior?: string; nuevo?: string }) {
  if (anterior === nuevo) return <span className="text-slate-600">Sin cambio</span>;
  return (
    <span className="break-all">
      <span className="text-slate-600 line-through">{anterior ?? "—"}</span>
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> cambió a </span>
      <span className="font-medium">{nuevo ?? "—"}</span>
    </span>
  );
}

/** RF-07: historial de cambios de contacto con usuario, fecha y hora. */
export function HistorialContacto({ cambios }: { cambios: CambioContacto[] }) {
  if (cambios.length === 0) {
    return <EstadoVacio titulo="Aún no hay cambios registrados en los datos de contacto" />;
  }
  return (
    <ContenedorTabla etiqueta="Historial de cambios de contacto">
      <thead>
        <tr>
          <th scope="col" className={clasesEncabezadoTabla}>Fecha y hora</th>
          <th scope="col" className={clasesEncabezadoTabla}>Realizado por</th>
          <th scope="col" className={clasesEncabezadoTabla}>Teléfono</th>
          <th scope="col" className={clasesEncabezadoTabla}>Correo</th>
        </tr>
      </thead>
      <tbody>
        {cambios.map((cambio) => (
          <tr key={cambio.id}>
            <td className={`${clasesCeldaTabla} whitespace-nowrap`}>{formatearFechaHora(cambio.fecha)}</td>
            <td className={clasesCeldaTabla}>{cambio.usuario}</td>
            <td className={clasesCeldaTabla}>
              <Valor anterior={cambio.anterior.telefono} nuevo={cambio.nuevo.telefono} />
            </td>
            <td className={clasesCeldaTabla}>
              <Valor anterior={cambio.anterior.correo} nuevo={cambio.nuevo.correo} />
            </td>
          </tr>
        ))}
      </tbody>
    </ContenedorTabla>
  );
}
