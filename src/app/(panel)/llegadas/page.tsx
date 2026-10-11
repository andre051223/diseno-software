import type { Metadata } from "next";
import Link from "next/link";
import { registrarLlegadaAccion } from "@/acciones/atencion";
import { BotonAccionCita } from "@/components/atencion/boton-accion-cita";
import { Alerta } from "@/components/ui/alerta";
import { clasesBoton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  Tarjeta,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { Paginacion, leerPagina } from "@/components/ui/paginacion";
import type { EstadoCita } from "@/generated/prisma/enums";
import { estadosCita, nombreMedico, nombrePaciente } from "@/lib/etiquetas";
import { formatearFechaLarga, formatearHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import type { CitaDetallada } from "@/servicios/agendamiento";
import { buscarCitasParaLlegada, citasDelDia, evaluarLlegada } from "@/servicios/atencion";

export const metadata: Metadata = { title: "Registro de llegada" };

const POR_PAGINA = 25;
const listaEstados = Object.keys(estadosCita) as EstadoCita[];

/** Botón de llegada o el motivo por el que no se puede registrar. */
function AccionLlegada({ cita, ahora }: { cita: CitaDetallada; ahora: Date }) {
  const evaluacion = evaluarLlegada({ estado: cita.estado, inicio: cita.espacio.inicio }, ahora);
  if (cita.estado === "en_sala" && cita.horaLlegada) {
    return <p className="text-slate-700">Llegó a las {formatearHora(cita.horaLlegada)}.</p>;
  }
  if (!evaluacion.permitido) return <p className="text-sm text-slate-700">{evaluacion.mensaje}</p>;
  return (
    <BotonAccionCita
      accion={registrarLlegadaAccion}
      citaId={cita.id}
      texto="Registrar llegada"
      textoEnviando="Registrando…"
      detalle={`de ${nombrePaciente(cita.paciente)} (${cita.codigo})`}
    />
  );
}

// RF-28: la recepcionista registra la llegada buscando por documento o por código de la cita.
export default async function PaginaLlegadas({ searchParams }: PageProps<"/llegadas">) {
  await requerirRol("recepcionista");
  const parametros = await searchParams;
  const ahora = new Date();
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim().slice(0, 40) : "";
  const estado = listaEstados.includes(parametros.estado as EstadoCita) ? (parametros.estado as EstadoCita) : undefined;
  const pagina = leerPagina(parametros.pagina);

  const [resultados, dia] = await Promise.all([
    busqueda ? buscarCitasParaLlegada(busqueda, ahora) : Promise.resolve(null),
    citasDelDia({ estado, pagina, porPagina: POR_PAGINA }, ahora),
  ]);
  const totalDia = Object.values(dia.conteo).reduce((suma, valor) => suma + (valor ?? 0), 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Registro de llegada"
        descripcion={`Citas de hoy, ${formatearFechaLarga(ahora)}. Busque al paciente por su número de documento o por el código de la cita.`}
      />

      <div className="space-y-6">
        <form
          role="search"
          className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <Campo
            nombre="q"
            etiqueta="Documento del paciente o código de la cita"
            type="search"
            defaultValue={busqueda}
            ayuda="Por ejemplo, 52037011 o HSR-7K3QX2."
            autoComplete="off"
          />
          <button type="submit" className={clasesBoton("primario")}>
            Buscar
          </button>
        </form>

        {resultados ? (
          <section aria-labelledby="titulo-resultados">
            <h2 id="titulo-resultados" className="mb-2 text-xl font-semibold">
              Resultado de la búsqueda
            </h2>
            {resultados.length === 0 ? (
              <EstadoVacio titulo="No hay citas de hoy con ese documento o código">
                Revise el dato escrito. Si el paciente no tiene cita, puede{" "}
                <Link href="/agendar" className="font-semibold text-petroleo-700 underline underline-offset-4">
                  agendarle una
                </Link>
                .
              </EstadoVacio>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {resultados.map((cita) => (
                  <li key={cita.id}>
                    <Tarjeta>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold">{nombrePaciente(cita.paciente)}</p>
                          <p className="text-slate-700">
                            {cita.paciente.tipoDocumento} {cita.paciente.numeroDocumento}
                          </p>
                        </div>
                        <Insignia tono={estadosCita[cita.estado].tono}>{estadosCita[cita.estado].etiqueta}</Insignia>
                      </div>
                      <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-slate-600">Hora</dt>
                          <dd>{formatearHora(cita.espacio.inicio)}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-600">Código</dt>
                          <dd className="font-mono">{cita.codigo}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-600">Médico</dt>
                          <dd>
                            {nombreMedico(cita.espacio.medico)} · {cita.especialidad.nombre}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-slate-600">Consultorio</dt>
                          <dd>
                            {cita.espacio.consultorio.nombre} ({cita.espacio.consultorio.ubicacion})
                          </dd>
                        </div>
                      </dl>
                      {cita.estado === "pendiente_validacion" ? (
                        <div className="mt-3">
                          <Alerta tipo="advertencia" titulo="Cobertura sin validar">
                            La aseguradora aún no confirma la cobertura. Revise el detalle de la cita con el paciente.
                          </Alerta>
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <AccionLlegada cita={cita} ahora={ahora} />
                        <Link
                          href={`/citas/${cita.id}`}
                          className="font-semibold text-petroleo-700 underline underline-offset-4"
                        >
                          Ver cita<span className="sr-only"> {cita.codigo}</span>
                        </Link>
                      </div>
                    </Tarjeta>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section aria-labelledby="titulo-dia">
          <h2 id="titulo-dia" className="mb-2 text-xl font-semibold">
            Citas de hoy
          </h2>
          <p className="mb-3 text-slate-700">
            {totalDia} {totalDia === 1 ? "cita" : "citas"} en total
            {totalDia > 0
              ? `: ${listaEstados
                  .filter((clave) => dia.conteo[clave])
                  .map((clave) => `${dia.conteo[clave]} ${estadosCita[clave].etiqueta.toLowerCase()}`)
                  .join(", ")}.`
              : "."}
          </p>
          <form className="mb-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            {busqueda ? <input type="hidden" name="q" value={busqueda} /> : null}
            <Selector
              nombre="estado"
              etiqueta="Estado"
              textoVacio="Todos"
              opciones={listaEstados.map((clave) => ({ valor: clave, etiqueta: estadosCita[clave].etiqueta }))}
              defaultValue={estado ?? ""}
            />
            <button type="submit" className={clasesBoton("secundario")}>
              Filtrar
            </button>
          </form>

          {dia.citas.length === 0 ? (
            <EstadoVacio titulo={estado ? "No hay citas de hoy en ese estado" : "No hay citas programadas para hoy"} />
          ) : (
            <ContenedorTabla etiqueta="Citas de hoy">
              <thead>
                <tr>
                  <th scope="col" className={clasesEncabezadoTabla}>Hora</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Paciente</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Médico y consultorio</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Llegada</th>
                </tr>
              </thead>
              <tbody>
                {dia.citas.map((cita) => (
                  <tr key={cita.id}>
                    <td className={`${clasesCeldaTabla} whitespace-nowrap font-semibold`}>
                      {formatearHora(cita.espacio.inicio)}
                    </td>
                    <td className={clasesCeldaTabla}>
                      <p>{nombrePaciente(cita.paciente)}</p>
                      <p className="text-sm text-slate-600">
                        {cita.paciente.tipoDocumento} {cita.paciente.numeroDocumento} ·{" "}
                        <Link href={`/citas/${cita.id}`} className="font-mono text-petroleo-700 underline underline-offset-4">
                          {cita.codigo}
                        </Link>
                      </p>
                    </td>
                    <td className={clasesCeldaTabla}>
                      <p>{nombreMedico(cita.espacio.medico)}</p>
                      <p className="text-sm text-slate-600">{cita.espacio.consultorio.nombre}</p>
                    </td>
                    <td className={clasesCeldaTabla}>
                      <Insignia tono={estadosCita[cita.estado].tono}>{estadosCita[cita.estado].etiqueta}</Insignia>
                    </td>
                    <td className={clasesCeldaTabla}>
                      {cita.horaLlegada ? (
                        formatearHora(cita.horaLlegada)
                      ) : evaluarLlegada({ estado: cita.estado, inicio: cita.espacio.inicio }, ahora).permitido ? (
                        <BotonAccionCita
                          accion={registrarLlegadaAccion}
                          citaId={cita.id}
                          texto="Registrar llegada"
                          textoEnviando="Registrando…"
                          detalle={`de ${nombrePaciente(cita.paciente)} (${cita.codigo})`}
                          variante="secundario"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ContenedorTabla>
          )}
          <Paginacion
            pagina={pagina}
            totalPaginas={Math.ceil(dia.total / POR_PAGINA)}
            ruta="/llegadas"
            parametros={{ q: busqueda || undefined, estado }}
          />
        </section>
      </div>
    </>
  );
}
