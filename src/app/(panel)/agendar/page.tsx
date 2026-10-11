import type { Metadata } from "next";
import Link from "next/link";
import { AsistenteHorarios } from "@/components/citas/asistente-horarios";
import { Alerta } from "@/components/ui/alerta";
import { clasesBoton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { nombrePaciente, nombresCanal } from "@/lib/etiquetas";
import { requerirRol } from "@/lib/sesion";
import { canalSegunRol } from "@/servicios/agendamiento";
import { filtroBusquedaPacientes } from "@/servicios/pacientes";

export const metadata: Metadata = { title: "Agendar cita" };

// RF-12 y RF-19: la recepcionista (canal ventanilla) o el agente telefónico (canal teléfono)
// agendan en nombre del paciente con el mismo asistente que usa el portal.
export default async function PaginaAgendar({ searchParams }: PageProps<"/agendar">) {
  const usuario = await requerirRol("recepcionista", "agente_telefonico");
  const parametros = await searchParams;
  const pacienteId = Number(parametros.paciente) || 0;
  const paciente = pacienteId
    ? await db.paciente.findUnique({ where: { id: pacienteId }, include: { aseguradora: true } })
    : null;
  const canal = nombresCanal[canalSegunRol(usuario.rol)].toLowerCase();

  if (paciente) {
    return (
      <>
        <EncabezadoPagina
          titulo="Agendar cita"
          descripcion={
            <>
              Para <strong>{nombrePaciente(paciente)}</strong> ({paciente.tipoDocumento} {paciente.numeroDocumento},{" "}
              {paciente.aseguradora.nombre}). Canal de origen: {canal}.{" "}
              <Link href="/agendar" className="font-semibold text-petroleo-700 underline underline-offset-4">
                Cambiar de paciente
              </Link>
            </>
          }
        />
        {parametros.aviso === "sin-agendar" ? (
          <div className="mb-6">
            <Alerta tipo="info">No se agendó la cita y el horario quedó libre. Registramos la decisión del paciente.</Alerta>
          </div>
        ) : null}
        <AsistenteHorarios
          contexto={{ rol: usuario.rol, pacienteId: paciente.id }}
          parametros={parametros}
          usuarioId={usuario.id}
        />
      </>
    );
  }

  const busqueda = typeof parametros.q === "string" ? parametros.q.trim().slice(0, 80) : "";
  const pacientes = busqueda
    ? await db.paciente.findMany({
        where: filtroBusquedaPacientes(busqueda),
        include: { aseguradora: true },
        orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
        take: 20,
      })
    : [];

  return (
    <>
      <EncabezadoPagina
        titulo="Agendar cita"
        descripcion={`Busque al paciente por documento o nombre. La cita quedará registrada con el canal ${canal}.`}
      />
      <form
        role="search"
        className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <Campo nombre="q" etiqueta="Documento o nombre del paciente" type="search" defaultValue={busqueda} />
        <button type="submit" className={clasesBoton("secundario")}>
          Buscar
        </button>
      </form>

      {!busqueda ? null : pacientes.length === 0 ? (
        <EstadoVacio titulo="No encontramos pacientes con esos datos">
          {usuario.rol === "recepcionista" ? (
            <>
              Revise el documento o{" "}
              <Link href="/pacientes/nuevo" className="font-semibold text-petroleo-700 underline underline-offset-4">
                registre al paciente
              </Link>
              .
            </>
          ) : (
            "Revise el documento o pida al paciente que se registre en el portal o en ventanilla."
          )}
        </EstadoVacio>
      ) : (
        <ContenedorTabla etiqueta="Pacientes encontrados">
          <thead>
            <tr>
              <th scope="col" className={clasesEncabezadoTabla}>Documento</th>
              <th scope="col" className={clasesEncabezadoTabla}>Paciente</th>
              <th scope="col" className={clasesEncabezadoTabla}>Aseguradora</th>
              <th scope="col" className={clasesEncabezadoTabla}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((item) => (
              <tr key={item.id}>
                <td className={`${clasesCeldaTabla} whitespace-nowrap`}>
                  {item.tipoDocumento} {item.numeroDocumento}
                </td>
                <td className={clasesCeldaTabla}>{nombrePaciente(item)}</td>
                <td className={clasesCeldaTabla}>{item.aseguradora.nombre}</td>
                <td className={clasesCeldaTabla}>
                  <Link
                    href={`/agendar?paciente=${item.id}`}
                    className="font-semibold text-petroleo-700 underline underline-offset-4"
                  >
                    Agendar<span className="sr-only"> para {nombrePaciente(item)}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>
      )}
    </>
  );
}
