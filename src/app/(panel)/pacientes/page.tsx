import type { Metadata } from "next";
import Link from "next/link";
import { EnlaceBoton, clasesBoton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { Paginacion, leerPagina } from "@/components/ui/paginacion";
import { db } from "@/lib/db";
import { nombrePaciente } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { filtroBusquedaPacientes } from "@/servicios/pacientes";

export const metadata: Metadata = { title: "Pacientes" };

const POR_PAGINA = 20;

// Búsqueda de pacientes para recepción y agentes telefónicos (RF-05 a RF-07).
export default async function PaginaPacientes({ searchParams }: PageProps<"/pacientes">) {
  const usuario = await requerirRol("recepcionista", "agente_telefonico");
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim().slice(0, 80) : "";
  const pagina = leerPagina(parametros.pagina);
  const filtro = filtroBusquedaPacientes(busqueda);

  const [total, pacientes] = await Promise.all([
    db.paciente.count({ where: filtro }),
    db.paciente.findMany({
      where: filtro,
      include: { aseguradora: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Pacientes"
        descripcion="Busque por número de documento, nombres o apellidos."
        acciones={
          usuario.rol === "recepcionista" ? <EnlaceBoton href="/pacientes/nuevo">Registrar paciente</EnlaceBoton> : null
        }
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

      {pacientes.length === 0 ? (
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
        <>
          <p className="mb-2 text-slate-700" aria-live="polite">
            {total === 1 ? "1 paciente encontrado." : `${total} pacientes encontrados.`}
          </p>
          <ContenedorTabla etiqueta="Resultados de la búsqueda de pacientes">
            <thead>
              <tr>
                <th scope="col" className={clasesEncabezadoTabla}>Documento</th>
                <th scope="col" className={clasesEncabezadoTabla}>Paciente</th>
                <th scope="col" className={clasesEncabezadoTabla}>Fecha de nacimiento</th>
                <th scope="col" className={clasesEncabezadoTabla}>Teléfono</th>
                <th scope="col" className={clasesEncabezadoTabla}>Aseguradora</th>
                <th scope="col" className={clasesEncabezadoTabla}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((paciente) => (
                <tr key={paciente.id}>
                  <td className={`${clasesCeldaTabla} whitespace-nowrap`}>
                    {paciente.tipoDocumento} {paciente.numeroDocumento}
                  </td>
                  <td className={clasesCeldaTabla}>{nombrePaciente(paciente)}</td>
                  <td className={clasesCeldaTabla}>{formatearFecha(paciente.fechaNacimiento)}</td>
                  <td className={clasesCeldaTabla}>{paciente.telefono}</td>
                  <td className={clasesCeldaTabla}>{paciente.aseguradora.nombre}</td>
                  <td className={clasesCeldaTabla}>
                    <Link
                      href={`/pacientes/${paciente.id}`}
                      className="font-semibold text-petroleo-700 underline underline-offset-4"
                    >
                      Ver ficha<span className="sr-only"> de {nombrePaciente(paciente)}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </>
      )}

      <Paginacion
        pagina={pagina}
        totalPaginas={Math.ceil(total / POR_PAGINA)}
        ruta="/pacientes"
        parametros={{ q: busqueda }}
      />
    </>
  );
}
