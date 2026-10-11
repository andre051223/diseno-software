import Link from "next/link";
import { z } from "zod";
import "@/lib/validaciones/idioma";
import { reservarEspacioAccion } from "@/acciones/citas";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { clasesBoton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import { EstadoVacio, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { nombreMedico } from "@/lib/etiquetas";
import { aFechaIso, diaSemanaIso, formatearFecha, formatearHora, nombresDiasSemana } from "@/lib/fechas";
import { baseAsistente, construirUrl, rutaDetalleCita, type ContextoAsistente } from "@/lib/rutas-citas";
import { diasMaximosBusqueda, esquemaBusquedaEspacios } from "@/lib/validaciones/citas";
import { buscarEspaciosLibres, citaActivaEnEspecialidad, maximoEspaciosListados } from "@/servicios/agendamiento";
import { sumarDiasIso } from "@/servicios/generador-espacios";
import { PasosAsistente } from "./pasos-asistente";

type Parametros = Record<string, string | string[] | undefined>;

function leer(parametros: Parametros, clave: string): string {
  const valor = parametros[clave];
  return typeof valor === "string" ? valor.slice(0, 20) : "";
}

const avisosError: Record<string, string> = {
  "no-disponible": "El horario que eligió acaba de ser tomado por otra persona o ya no está disponible. Por favor, elija otro.",
  "cita-activa": "El paciente ya tiene una cita activa en esta especialidad. Puede reprogramarla o cancelarla.",
};

/** Hidden inputs con los parámetros que deben acompañar siempre al asistente. */
function Ocultos({ valores }: { valores: Record<string, string> }) {
  return (
    <>
      {Object.entries(valores).map(([clave, valor]) => (
        <input key={clave} type="hidden" name={clave} value={valor} />
      ))}
    </>
  );
}

/**
 * Pasos 1 a 3 del asistente: especialidad, médico y fecha, y horario.
 * RF-12: muestra los espacios libres filtrados por especialidad, médico y rango de fechas.
 * Al elegir un horario se reserva temporalmente (RF-14) y se pasa a la confirmación.
 */
export async function AsistenteHorarios({
  contexto,
  parametros,
  usuarioId,
  reprogramacion,
}: {
  contexto: ContextoAsistente;
  parametros: Parametros;
  usuarioId: number;
  reprogramacion?: { especialidadId: number; espacioActualId: number };
}) {
  const base = baseAsistente(contexto);
  const hoy = aFechaIso(new Date());
  const error = avisosError[leer(parametros, "error")];
  const especialidadId = reprogramacion?.especialidadId ?? (Number(leer(parametros, "especialidad")) || 0);
  const modo = reprogramacion ? "reprogramar" : "nueva";

  // Paso 1: especialidad (solo las activas que tienen al menos un médico activo).
  const especialidades = await db.especialidad.findMany({
    where: { activo: true, medicos: { some: { activo: true } } },
    orderBy: { nombre: "asc" },
  });
  const especialidad = especialidades.find((item) => item.id === especialidadId);

  if (!especialidad) {
    return (
      <>
        <PasosAsistente actual={1} />
        {error ? <Alerta tipo="error">{error}</Alerta> : null}
        <Tarjeta titulo="¿Qué especialidad necesita?">
          {especialidades.length === 0 ? (
            <EstadoVacio titulo="No hay especialidades con médicos disponibles en este momento" />
          ) : (
            <form className="space-y-4">
              <Ocultos valores={base.fijos} />
              <Selector
                nombre="especialidad"
                etiqueta="Especialidad"
                required
                textoVacio="Seleccione la especialidad"
                opciones={especialidades.map((item) => ({ valor: item.id, etiqueta: item.nombre }))}
                defaultValue=""
              />
              <button type="submit" className={clasesBoton("primario")}>
                Continuar
              </button>
            </form>
          )}
        </Tarjeta>
      </>
    );
  }

  // RF-18: si ya tiene una cita activa en la especialidad no se le ofrece otra.
  if (!reprogramacion) {
    const activa = await citaActivaEnEspecialidad(contexto.pacienteId, especialidad.id);
    if (activa) {
      return (
        <>
          <PasosAsistente actual={2} />
          <Alerta tipo="advertencia" titulo="Ya tiene una cita activa en esta especialidad">
            <p>
              Hay una cita de {especialidad.nombre.toLowerCase()} el {formatearFecha(activa.espacio.inicio)} a las{" "}
              {formatearHora(activa.espacio.inicio)}. Solo se permite una cita activa por especialidad; si necesita otro
              horario, reprograme esa cita.
            </p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link href={rutaDetalleCita(contexto.rol, activa.id)} className="font-semibold underline underline-offset-4">
                Ver la cita activa
              </Link>
              <Link href={construirUrl(base.ruta, base.fijos)} className="font-semibold underline underline-offset-4">
                Elegir otra especialidad
              </Link>
            </p>
          </Alerta>
        </>
      );
    }
  }

  // Paso 2: médico y rango de fechas.
  const medicos = await db.medico.findMany({
    where: { activo: true, especialidades: { some: { id: especialidad.id } } },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
  });
  const desdeTexto = leer(parametros, "desde");
  const hastaTexto = leer(parametros, "hasta");
  const medicoTexto = leer(parametros, "medico");
  const buscar = Boolean(desdeTexto || hastaTexto);
  const validacion = buscar
    ? esquemaBusquedaEspacios.safeParse({
        especialidad: String(especialidad.id),
        medico: medicoTexto,
        desde: desdeTexto,
        hasta: hastaTexto,
      })
    : null;
  const errores = validacion && !validacion.success ? z.flattenError(validacion.error).fieldErrors : undefined;
  const filtro = validacion?.success ? validacion.data : null;
  const desdeValido = filtro ? (filtro.desde < hoy ? hoy : filtro.desde) : null;

  const resultado =
    filtro && desdeValido
      ? await buscarEspaciosLibres(
          {
            especialidadId: especialidad.id,
            medicoId: filtro.medico,
            desde: desdeValido,
            hasta: filtro.hasta,
            excluirEspacioId: reprogramacion?.espacioActualId,
          },
          usuarioId,
        )
      : null;

  const consulta = new URLSearchParams(
    Object.entries({
      especialidad: String(especialidad.id),
      medico: medicoTexto,
      desde: desdeTexto,
      hasta: hastaTexto,
    }).filter(([, valor]) => valor),
  ).toString();

  // Agrupa los espacios por día para presentarlos en orden.
  const dias = new Map<string, NonNullable<typeof resultado>["espacios"]>();
  for (const espacio of resultado?.espacios ?? []) {
    const clave = aFechaIso(espacio.inicio);
    dias.set(clave, [...(dias.get(clave) ?? []), espacio]);
  }

  return (
    <>
      <PasosAsistente actual={resultado ? (modo === "nueva" ? 3 : 2) : modo === "nueva" ? 2 : 1} modo={modo} />
      {error ? (
        <div className="mb-6">
          <Alerta tipo="error">{error}</Alerta>
        </div>
      ) : null}

      <Tarjeta titulo="Médico y fechas" className="mb-6">
        <p className="mb-4 text-slate-700">
          Especialidad: <strong>{especialidad.nombre}</strong>
          {!reprogramacion ? (
            <>
              {" · "}
              <Link
                href={construirUrl(base.ruta, base.fijos)}
                className="font-semibold text-petroleo-700 underline underline-offset-4"
              >
                Cambiar especialidad
              </Link>
            </>
          ) : null}
        </p>
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end" noValidate>
          <Ocultos valores={reprogramacion ? base.fijos : { ...base.fijos, especialidad: String(especialidad.id) }} />
          <Selector
            nombre="medico"
            etiqueta="Médico"
            textoVacio="Cualquier médico"
            opciones={medicos.map((medico) => ({ valor: medico.id, etiqueta: nombreMedico(medico) }))}
            defaultValue={medicoTexto}
          />
          <Campo
            nombre="desde"
            etiqueta="Desde"
            type="date"
            required
            min={hoy}
            defaultValue={desdeTexto || hoy}
            errores={errores?.desde}
          />
          <Campo
            nombre="hasta"
            etiqueta="Hasta"
            type="date"
            required
            min={hoy}
            max={sumarDiasIso(hoy, diasMaximosBusqueda)}
            defaultValue={hastaTexto || sumarDiasIso(hoy, 13)}
            errores={errores?.hasta}
          />
          <button type="submit" className={clasesBoton(resultado ? "secundario" : "primario")}>
            Ver horarios disponibles
          </button>
        </form>
      </Tarjeta>

      {resultado ? (
        <section aria-labelledby="titulo-horarios">
          <h2 id="titulo-horarios" className="mb-2 text-xl font-semibold">
            Horarios disponibles
          </h2>
          {resultado.total === 0 ? (
            <EstadoVacio titulo="No hay horarios libres con esos filtros">
              Pruebe con otro médico o con un rango de fechas más amplio.
            </EstadoVacio>
          ) : (
            <form action={reservarEspacioAccion} className="space-y-4">
              <p className="text-slate-700" aria-live="polite">
                {resultado.total === 1 ? "1 horario disponible." : `${resultado.total} horarios disponibles.`}
                {resultado.total > maximoEspaciosListados
                  ? ` Se muestran los primeros ${maximoEspaciosListados}; acote el rango de fechas o elija un médico para ver otros.`
                  : ""}
              </p>
              <input type="hidden" name="especialidadId" value={especialidad.id} />
              <input type="hidden" name="consulta" value={consulta} />
              {contexto.rol !== "paciente" ? <input type="hidden" name="pacienteId" value={contexto.pacienteId} /> : null}
              {contexto.citaId ? <input type="hidden" name="citaId" value={contexto.citaId} /> : null}
              {[...dias.entries()].map(([dia, espacios]) => (
                <fieldset key={dia} className="rounded-xl border border-slate-200 bg-white p-4">
                  <legend className="px-1 text-lg font-semibold text-petroleo-900">
                    {nombresDiasSemana[diaSemanaIso(espacios[0].inicio)]}, {formatearFecha(espacios[0].inicio)}
                  </legend>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {espacios.map((espacio) => (
                      <li key={espacio.id}>
                        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-300 p-3 hover:border-petroleo-600 has-[:checked]:border-petroleo-700 has-[:checked]:bg-petroleo-50">
                          <input
                            type="radio"
                            name="espacioId"
                            value={espacio.id}
                            required
                            className="mt-1 size-5 accent-petroleo-700"
                          />
                          <span>
                            <span className="block text-lg font-semibold">{formatearHora(espacio.inicio)}</span>
                            <span className="block">{nombreMedico(espacio.medico)}</span>
                            <span className="block text-sm text-slate-600">{espacio.consultorio.nombre}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
              <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <BotonEnviar textoEnviando="Reservando el horario…">Reservar horario y continuar</BotonEnviar>
              </div>
            </form>
          )}
        </section>
      ) : null}
    </>
  );
}
