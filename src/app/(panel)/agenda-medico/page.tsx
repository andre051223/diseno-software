import type { Metadata } from "next";
import Link from "next/link";
import { ActualizacionAutomatica } from "@/components/atencion/actualizacion-automatica";
import { Alerta } from "@/components/ui/alerta";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { estadosCita, nombrePaciente } from "@/lib/etiquetas";
import { formatearFechaLarga, formatearHora, formatearHoraConSegundos } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { agendaDelDia, estadosEsperandoLlegada } from "@/servicios/atencion";

export const metadata: Metadata = { title: "Agenda del día" };

/** Texto del avance de la atención para la columna de seguimiento. */
function seguimiento(cita: { horaLlegada: Date | null; inicioAtencion: Date | null; finAtencion: Date | null }) {
  if (cita.inicioAtencion && cita.finAtencion) {
    return `Atendido de ${formatearHora(cita.inicioAtencion)} a ${formatearHora(cita.finAtencion)}`;
  }
  if (cita.inicioAtencion) return `En atención desde las ${formatearHora(cita.inicioAtencion)}`;
  if (cita.horaLlegada) return `En sala desde las ${formatearHora(cita.horaLlegada)}`;
  return "—";
}

// RF-29: lista del día del médico con hora, paciente y estado; se actualiza sola cada 30 segundos.
export default async function PaginaAgendaMedico() {
  const usuario = await requerirRol("medico");
  const ahora = new Date();

  if (!usuario.medicoId) {
    return (
      <>
        <EncabezadoPagina titulo="Agenda del día" />
        <Alerta tipo="advertencia">
          Su cuenta no está asociada a un médico. Solicite al coordinador de agenda que la vincule.
        </Alerta>
      </>
    );
  }

  const citas = await agendaDelDia(usuario.medicoId, ahora);
  const resumen: [string, number][] = [
    ["En sala", citas.filter((cita) => cita.estado === "en_sala").length],
    ["Por llegar", citas.filter((cita) => estadosEsperandoLlegada.includes(cita.estado)).length],
    ["Atendidas", citas.filter((cita) => cita.estado === "atendida").length],
  ];

  return (
    <>
      <EncabezadoPagina titulo="Agenda del día" descripcion={`Hoy, ${formatearFechaLarga(ahora)}.`} />
      <div className="space-y-4">
        <ActualizacionAutomatica segundos={30} actualizadoEn={formatearHoraConSegundos(ahora)} />
        <dl className="grid gap-3 sm:grid-cols-3">
          {resumen.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-sm font-medium text-slate-600">{etiqueta}</dt>
              <dd className="text-2xl font-bold">{valor}</dd>
            </div>
          ))}
        </dl>

        {citas.length === 0 ? (
          <EstadoVacio titulo="No tiene citas programadas para hoy" />
        ) : (
          <ContenedorTabla etiqueta="Citas del día">
            <thead>
              <tr>
                <th scope="col" className={clasesEncabezadoTabla}>Hora</th>
                <th scope="col" className={clasesEncabezadoTabla}>Paciente</th>
                <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
                <th scope="col" className={clasesEncabezadoTabla}>Seguimiento</th>
                <th scope="col" className={clasesEncabezadoTabla}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {citas.map((cita) => (
                <tr key={cita.id} className={cita.estado === "en_sala" ? "bg-petroleo-50" : undefined}>
                  <td className={`${clasesCeldaTabla} whitespace-nowrap font-semibold`}>
                    {formatearHora(cita.espacio.inicio)}
                  </td>
                  <td className={clasesCeldaTabla}>
                    <p>{nombrePaciente(cita.paciente)}</p>
                    <p className="text-sm text-slate-600">
                      {cita.especialidad.nombre} · {cita.espacio.consultorio.nombre}
                    </p>
                  </td>
                  <td className={clasesCeldaTabla}>
                    <Insignia tono={estadosCita[cita.estado].tono}>{estadosCita[cita.estado].etiqueta}</Insignia>
                  </td>
                  <td className={clasesCeldaTabla}>{seguimiento(cita)}</td>
                  <td className={clasesCeldaTabla}>
                    <Link
                      href={`/agenda-medico/${cita.id}`}
                      className="font-semibold text-petroleo-700 underline underline-offset-4"
                    >
                      {cita.estado === "en_sala" ? "Atender" : "Ver detalle"}
                      <span className="sr-only"> a {nombrePaciente(cita.paciente)}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        )}
      </div>
    </>
  );
}
