import Link from "next/link";
import { liberarReservaAccion } from "@/acciones/citas";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { nombrePaciente } from "@/lib/etiquetas";
import { baseAsistente, construirUrl, filtrosDeConsulta, type ContextoAsistente } from "@/lib/rutas-citas";
import { obtenerReservaVigente } from "@/servicios/agendamiento";
import { ConfirmacionCita } from "./confirmacion-cita";
import { CuentaRegresiva } from "./cuenta-regresiva";
import { PasosAsistente } from "./pasos-asistente";
import { ResumenEspacio } from "./resumen-espacio";

type Parametros = Record<string, string | string[] | undefined>;

function consultaDe(parametros: Parametros): string {
  const texto = new URLSearchParams(
    Object.entries(parametros).filter((par): par is [string, string] => typeof par[1] === "string"),
  ).toString();
  return new URLSearchParams(filtrosDeConsulta(texto)).toString();
}

/** Pasos 4 y 5 del asistente para una cita nueva: resumen, cobertura y confirmación. */
export async function PaginaConfirmar({
  contexto,
  parametros,
  usuarioId,
}: {
  contexto: ContextoAsistente;
  parametros: Parametros;
  usuarioId: number;
}) {
  const base = baseAsistente(contexto);
  const consulta = consultaDe(parametros);
  const volver = construirUrl(base.ruta, { ...base.fijos, ...filtrosDeConsulta(consulta) });
  const espacioId = Number(parametros.espacio) || 0;
  const especialidadId = Number(parametros.especialidad) || 0;

  const [reserva, especialidad, paciente] = await Promise.all([
    obtenerReservaVigente(espacioId, usuarioId),
    db.especialidad.findUnique({ where: { id: especialidadId } }),
    db.paciente.findUnique({ where: { id: contexto.pacienteId }, include: { aseguradora: true } }),
  ]);

  if (!reserva || !especialidad || !paciente) {
    return (
      <>
        <PasosAsistente actual={4} />
        <Alerta tipo="advertencia" titulo="El horario ya no está reservado">
          <p>La reserva temporal venció o el horario fue tomado por otra persona.</p>
          <p className="mt-2">
            <Link href={volver} className="font-semibold underline underline-offset-4">
              Volver a elegir un horario
            </Link>
          </p>
        </Alerta>
      </>
    );
  }

  return (
    <>
      <PasosAsistente actual={4} />
      <div className="space-y-6">
        <CuentaRegresiva
          hasta={reserva.reservadoHasta!.toISOString()}
          alVencer={
            <Link href={volver} className="font-semibold underline underline-offset-4">
              Volver a elegir un horario
            </Link>
          }
        />
        <Tarjeta titulo="Resumen de la cita">
          <ResumenEspacio espacio={reserva} especialidad={especialidad.nombre} paciente={nombrePaciente(paciente)} />
          <form action={liberarReservaAccion} className="mt-4">
            <input type="hidden" name="espacioId" value={reserva.id} />
            <input type="hidden" name="especialidadId" value={especialidad.id} />
            <input type="hidden" name="consulta" value={consulta} />
            {contexto.rol !== "paciente" ? <input type="hidden" name="pacienteId" value={paciente.id} /> : null}
            <BotonEnviar variante="discreto" textoEnviando="Liberando el horario…">
              Elegir otro horario
            </BotonEnviar>
          </form>
        </Tarjeta>
        <Tarjeta titulo="Validación de cobertura">
          <ConfirmacionCita
            espacioId={reserva.id}
            especialidadId={especialidad.id}
            pacienteId={contexto.rol !== "paciente" ? paciente.id : undefined}
            aseguradora={paciente.aseguradora.nombre}
          />
        </Tarjeta>
      </div>
    </>
  );
}
