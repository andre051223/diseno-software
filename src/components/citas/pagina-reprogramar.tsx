import Link from "next/link";
import { liberarReservaAccion } from "@/acciones/citas";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { baseAsistente, construirUrl, filtrosDeConsulta, rutaDetalleCita, type ContextoAsistente } from "@/lib/rutas-citas";
import type { UsuarioActual } from "@/lib/sesion";
import { evaluarCambio, obtenerReservaVigente, type CitaDetallada } from "@/servicios/agendamiento";
import { AsistenteHorarios } from "./asistente-horarios";
import { CuentaRegresiva } from "./cuenta-regresiva";
import { FormularioReprogramacion } from "./formularios-cita";
import { PasosAsistente } from "./pasos-asistente";
import { ResumenEspacio } from "./resumen-espacio";

type Parametros = Record<string, string | string[] | undefined>;

function Encabezado({ actor, cita }: { actor: UsuarioActual; cita: CitaDetallada }) {
  return (
    <>
      <Link
        href={rutaDetalleCita(actor.rol, cita.id)}
        className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4"
      >
        ← Volver a la cita {cita.codigo}
      </Link>
      <EncabezadoPagina
        titulo="Reprogramar cita"
        descripcion={`${cita.especialidad.nombre}. El horario actual se libera solo cuando confirme el nuevo.`}
      />
    </>
  );
}

/** Aviso cuando la cita ya no se puede reprogramar (RF-17). Devuelve null si sí se puede. */
function BloqueoCambio({ actor, cita }: { actor: UsuarioActual; cita: CitaDetallada }) {
  const evaluacion = evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, actor.rol);
  if (evaluacion.permitido) return null;
  return (
    <Alerta tipo="advertencia" titulo="No es posible reprogramar">
      {evaluacion.mensaje}
    </Alerta>
  );
}

/** RF-16: pasos de búsqueda del nuevo horario para reprogramar. */
export function PaginaReprogramar({
  actor,
  cita,
  parametros,
}: {
  actor: UsuarioActual;
  cita: CitaDetallada;
  parametros: Parametros;
}) {
  const contexto: ContextoAsistente = { rol: actor.rol, pacienteId: cita.pacienteId, citaId: cita.id };
  return (
    <>
      <Encabezado actor={actor} cita={cita} />
      {evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, actor.rol).permitido ? (
        <AsistenteHorarios
          contexto={contexto}
          parametros={parametros}
          usuarioId={actor.id}
          reprogramacion={{ especialidadId: cita.especialidadId, espacioActualId: cita.espacioId }}
        />
      ) : (
        <BloqueoCambio actor={actor} cita={cita} />
      )}
    </>
  );
}

/** RF-16: confirmación del cambio, con el horario actual y el nuevo. */
export async function PaginaConfirmarReprogramacion({
  actor,
  cita,
  parametros,
}: {
  actor: UsuarioActual;
  cita: CitaDetallada;
  parametros: Parametros;
}) {
  const contexto: ContextoAsistente = { rol: actor.rol, pacienteId: cita.pacienteId, citaId: cita.id };
  const base = baseAsistente(contexto);
  const consulta = new URLSearchParams(
    filtrosDeConsulta(
      new URLSearchParams(
        Object.entries(parametros).filter((par): par is [string, string] => typeof par[1] === "string"),
      ).toString(),
    ),
  ).toString();
  const volver = construirUrl(base.ruta, { ...base.fijos, ...filtrosDeConsulta(consulta) });
  const reserva = await obtenerReservaVigente(Number(parametros.espacio) || 0, actor.id);

  return (
    <>
      <Encabezado actor={actor} cita={cita} />
      <PasosAsistente actual={3} modo="reprogramar" />
      {!evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, actor.rol).permitido ? (
        <BloqueoCambio actor={actor} cita={cita} />
      ) : !reserva ? (
        <Alerta tipo="advertencia" titulo="El horario ya no está reservado">
          <p>La reserva temporal venció o el horario fue tomado por otra persona.</p>
          <p className="mt-2">
            <Link href={volver} className="font-semibold underline underline-offset-4">
              Volver a elegir un horario
            </Link>
          </p>
        </Alerta>
      ) : (
        <div className="space-y-6">
          <CuentaRegresiva
            hasta={reserva.reservadoHasta!.toISOString()}
            alVencer={
              <Link href={volver} className="font-semibold underline underline-offset-4">
                Volver a elegir un horario
              </Link>
            }
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Tarjeta titulo="Horario actual">
              <ResumenEspacio espacio={cita.espacio} especialidad={cita.especialidad.nombre} />
            </Tarjeta>
            <Tarjeta titulo="Nuevo horario" className="border-petroleo-600">
              <ResumenEspacio espacio={reserva} especialidad={cita.especialidad.nombre} />
            </Tarjeta>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <FormularioReprogramacion citaId={cita.id} espacioId={reserva.id} />
            <form action={liberarReservaAccion}>
              <input type="hidden" name="espacioId" value={reserva.id} />
              <input type="hidden" name="especialidadId" value={cita.especialidadId} />
              <input type="hidden" name="citaId" value={cita.id} />
              <input type="hidden" name="consulta" value={consulta} />
              {actor.rol !== "paciente" ? <input type="hidden" name="pacienteId" value={cita.pacienteId} /> : null}
              <BotonEnviar variante="secundario" textoEnviando="Liberando el horario…">
                Elegir otro horario
              </BotonEnviar>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
