import type { Metadata } from "next";
import { ejecutarTareasAccion } from "@/acciones/tareas";
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
import { configuracion } from "@/lib/configuracion";
import { formatearFechaHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { ultimasEjecuciones, type ResumenTareas } from "@/servicios/tareas";

export const metadata: Metadata = { title: "Tareas programadas" };

const tareas = [
  {
    requisito: "RF-14",
    nombre: "Liberación de reservas vencidas",
    descripcion: `Devuelve a «libre» los horarios reservados temporalmente hace más de ${configuracion.minutosReservaTemporal} minutos sin completar la cita.`,
  },
  {
    requisito: "RF-23",
    nombre: "Reintentos de cobertura",
    descripcion: "Vuelve a consultar a la aseguradora las citas que quedaron pendientes de validación.",
  },
  {
    requisito: "RF-31",
    nombre: "Marca de inasistencia",
    descripcion: `Marca como inasistencia las citas sin registro de llegada ${configuracion.minutosParaInasistencia} minutos después de su hora.`,
  },
  {
    requisito: "RF-25",
    nombre: "Recordatorios",
    descripcion: `Envía por correo y SMS el recordatorio de las citas agendadas que empiezan en las próximas ${configuracion.horasAntesRecordatorio} horas, con enlaces para confirmar o cancelar.`,
  },
];

function plural(cantidad: number, singular: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

function DetalleResumen({ resumen }: { resumen: ResumenTareas }) {
  const { coberturas } = resumen;
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>{plural(resumen.reservasLiberadas, "reserva vencida liberada", "reservas vencidas liberadas")}.</li>
      <li>
        {plural(coberturas.revisadas, "cita pendiente revisada", "citas pendientes revisadas")}:{" "}
        {coberturas.cubiertas} con cobertura, {coberturas.rechazadas} sin vigencia o cobertura y {coberturas.sinRespuesta}{" "}
        sin respuesta.
      </li>
      <li>{plural(resumen.recordatoriosEnviados, "recordatorio enviado", "recordatorios enviados")} (correo y SMS).</li>
      <li>{plural(resumen.inasistencias ?? 0, "cita marcada", "citas marcadas")} como inasistencia.</li>
    </ul>
  );
}

// RF-14, RF-23, RF-25 y RF-31: ejecución manual de los procesos programados para la demostración.
export default async function PaginaTareas({ searchParams }: PageProps<"/tareas">) {
  await requerirRol("administrador");
  const { ejecutada } = await searchParams;
  const ejecuciones = await ultimasEjecuciones();
  const ultima = ejecuciones[0];

  return (
    <>
      <EncabezadoPagina
        titulo="Tareas programadas"
        descripcion="En producción un programador las ejecuta periódicamente llamando a /api/tareas con el token configurado. Aquí puede ejecutarlas a mano."
      />

      <div className="space-y-6">
        {ejecutada === "1" && ultima?.resumen ? (
          <Alerta tipo="exito" titulo="Tareas ejecutadas">
            <DetalleResumen resumen={ultima.resumen} />
          </Alerta>
        ) : null}

        <Tarjeta titulo="Procesos">
          <ul className="space-y-4">
            {tareas.map((tarea) => (
              <li key={tarea.requisito}>
                <p className="font-semibold">
                  {tarea.nombre} <span className="text-sm font-normal text-slate-600">({tarea.requisito})</span>
                </p>
                <p className="text-slate-700">{tarea.descripcion}</p>
              </li>
            ))}
          </ul>
          <form action={ejecutarTareasAccion} className="mt-6">
            <BotonEnviar textoEnviando="Ejecutando tareas…">Ejecutar tareas programadas</BotonEnviar>
          </form>
          <p className="mt-3 text-sm text-slate-600">
            Los reintentos de cobertura pueden tardar unos segundos si la aseguradora responde con lentitud.
          </p>
        </Tarjeta>

        <section aria-labelledby="titulo-ejecuciones">
          <h2 id="titulo-ejecuciones" className="mb-2 text-xl font-semibold">
            Últimas ejecuciones
          </h2>
          {ejecuciones.length === 0 ? (
            <EstadoVacio titulo="Aún no se han ejecutado las tareas programadas" />
          ) : (
            <ContenedorTabla etiqueta="Últimas ejecuciones de las tareas programadas">
              <thead>
                <tr>
                  <th scope="col" className={clasesEncabezadoTabla}>Fecha y hora</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Origen</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Reservas liberadas</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Coberturas revisadas</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Recordatorios</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Inasistencias</th>
                </tr>
              </thead>
              <tbody>
                {ejecuciones.map((ejecucion) => (
                  <tr key={ejecucion.id}>
                    <td className={`${clasesCeldaTabla} whitespace-nowrap`}>{formatearFechaHora(ejecucion.fecha)}</td>
                    <td className={clasesCeldaTabla}>
                      <Insignia tono={ejecucion.origen === "api" ? "info" : "neutro"}>
                        {ejecucion.origen === "api" ? "Programador (API)" : `Panel · ${ejecucion.usuario ?? "Administrador"}`}
                      </Insignia>
                    </td>
                    <td className={clasesCeldaTabla}>{ejecucion.resumen?.reservasLiberadas ?? "—"}</td>
                    <td className={clasesCeldaTabla}>{ejecucion.resumen?.coberturas.revisadas ?? "—"}</td>
                    <td className={clasesCeldaTabla}>{ejecucion.resumen?.recordatoriosEnviados ?? "—"}</td>
                    <td className={clasesCeldaTabla}>{ejecucion.resumen?.inasistencias ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          )}
        </section>
      </div>
    </>
  );
}
