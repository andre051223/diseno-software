import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelarCitasNovedadAccion } from "@/acciones/coordinacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  Tarjeta,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { estadosCita, nombreMedico, nombrePaciente, nombresTipoNovedad } from "@/lib/etiquetas";
import { formatearFecha, formatearFechaHora, formatearHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { estadosModificables } from "@/servicios/agendamiento";
import { citasAfectadasPorNovedad } from "@/servicios/novedades";

export const metadata: Metadata = { title: "Detalle de la novedad" };

// RF-11: lista al coordinador las citas ya asignadas en el periodo de la novedad.
export default async function PaginaNovedad({ params, searchParams }: PageProps<"/coordinacion/novedades/[id]">) {
  await requerirRol("coordinador_agenda");
  const { id } = await params;
  const { registrada, canceladas: textoCanceladas } = await searchParams;
  const canceladas = typeof textoCanceladas === "string" && /^\d+$/.test(textoCanceladas) ? Number(textoCanceladas) : undefined;
  const novedad = await db.novedad.findUnique({
    where: { id: Number(id) || 0 },
    include: { medico: true, creadaPor: { select: { nombre: true } }, _count: { select: { espacios: true } } },
  });
  if (!novedad) notFound();

  const citas = await citasAfectadasPorNovedad(novedad);
  // RF-27: solo se cancelan las citas futuras que el paciente aún no ha iniciado.
  const ahora = new Date();
  const cancelables = citas.filter(
    (cita) => estadosModificables.includes(cita.estado) && cita.espacio.inicio > ahora,
  ).length;

  return (
    <>
      <Link
        href="/coordinacion/novedades"
        className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4"
      >
        ← Volver a novedades
      </Link>
      <EncabezadoPagina
        titulo={`${nombresTipoNovedad[novedad.tipo]} de ${nombreMedico(novedad.medico)}`}
        descripcion={`Del ${formatearFechaHora(novedad.inicio)} al ${formatearFechaHora(novedad.fin)}.`}
      />

      <div className="space-y-6">
        {registrada === "1" ? (
          <Alerta tipo="exito">
            La novedad quedó registrada y se bloquearon {novedad._count.espacios}{" "}
            {novedad._count.espacios === 1 ? "espacio" : "espacios"} del médico en ese periodo.
          </Alerta>
        ) : null}
        {canceladas !== undefined ? (
          <Alerta tipo="exito" titulo="Citas canceladas">
            Se {canceladas === 1 ? "canceló 1 cita" : `cancelaron ${canceladas} citas`} y se avisó a{" "}
            {canceladas === 1 ? "el paciente" : "cada paciente"} por correo y SMS con el motivo y un enlace para
            reprogramar.
          </Alerta>
        ) : null}

        <Tarjeta titulo="Resumen">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-slate-600">Espacios bloqueados</dt>
              <dd className="text-lg">{novedad._count.espacios}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Citas asignadas en el periodo</dt>
              <dd className="text-lg">{citas.length}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Registrada por</dt>
              <dd className="text-lg">
                {novedad.creadaPor?.nombre ?? "Sistema"} · {formatearFechaHora(novedad.creadoEn)}
              </dd>
            </div>
            {novedad.motivo ? (
              <div className="sm:col-span-3">
                <dt className="text-sm font-medium text-slate-600">Observaciones</dt>
                <dd>{novedad.motivo}</dd>
              </div>
            ) : null}
          </dl>
        </Tarjeta>

        <section aria-labelledby="titulo-citas">
          <h2 id="titulo-citas" className="mb-2 text-xl font-semibold">
            Citas ya asignadas en el periodo
          </h2>
          {citas.length === 0 ? (
            <EstadoVacio titulo="No hay citas asignadas en este periodo">
              Ningún paciente se ve afectado por la novedad.
            </EstadoVacio>
          ) : (
            <>
              <Alerta tipo="advertencia" titulo="Estas citas requieren gestión">
                <p>
                  El médico no podrá atender estas citas. Puede cancelarlas y el sistema avisará a cada paciente por
                  correo y SMS con el motivo y un enlace para elegir un nuevo horario. Los horarios siguen bloqueados por
                  la novedad.
                </p>
                {cancelables > 0 ? (
                  <form action={cancelarCitasNovedadAccion} className="mt-3">
                    <input type="hidden" name="novedadId" value={novedad.id} />
                    <BotonEnviar variante="peligro" textoEnviando="Cancelando y avisando…">
                      {`Cancelar ${cancelables === 1 ? "la cita" : `las ${cancelables} citas`} y avisar a los pacientes`}
                    </BotonEnviar>
                  </form>
                ) : (
                  <p className="mt-2">Las citas listadas ya están en curso y no se pueden cancelar desde aquí.</p>
                )}
              </Alerta>
              <div className="mt-4">
                <ContenedorTabla etiqueta="Citas afectadas por la novedad">
                  <thead>
                    <tr>
                      <th scope="col" className={clasesEncabezadoTabla}>Fecha y hora</th>
                      <th scope="col" className={clasesEncabezadoTabla}>Código</th>
                      <th scope="col" className={clasesEncabezadoTabla}>Paciente</th>
                      <th scope="col" className={clasesEncabezadoTabla}>Contacto</th>
                      <th scope="col" className={clasesEncabezadoTabla}>Especialidad y consultorio</th>
                      <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map((cita) => (
                      <tr key={cita.id}>
                        <td className={`${clasesCeldaTabla} whitespace-nowrap`}>
                          {formatearFecha(cita.espacio.inicio)} {formatearHora(cita.espacio.inicio)}
                        </td>
                        <td className={`${clasesCeldaTabla} font-mono`}>{cita.codigo}</td>
                        <td className={clasesCeldaTabla}>
                          <p>{nombrePaciente(cita.paciente)}</p>
                          <p className="text-sm text-slate-600">
                            {cita.paciente.tipoDocumento} {cita.paciente.numeroDocumento}
                          </p>
                        </td>
                        <td className={`${clasesCeldaTabla} break-all`}>
                          <p>{cita.paciente.telefono}</p>
                          <p className="text-sm">{cita.paciente.correo}</p>
                        </td>
                        <td className={clasesCeldaTabla}>
                          <p>{cita.especialidad.nombre}</p>
                          <p className="text-sm text-slate-600">{cita.espacio.consultorio.nombre}</p>
                        </td>
                        <td className={clasesCeldaTabla}>
                          <Insignia tono={estadosCita[cita.estado].tono}>{estadosCita[cita.estado].etiqueta}</Insignia>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ContenedorTabla>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
