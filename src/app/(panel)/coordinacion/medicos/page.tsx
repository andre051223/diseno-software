import type { Metadata } from "next";
import Link from "next/link";
import { EnlaceBoton, clasesBoton } from "@/components/ui/boton";
import { Campo, Selector } from "@/components/ui/campo";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { nombreMedico } from "@/lib/etiquetas";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Médicos" };

// RF-09: listado de médicos con sus especialidades.
export default async function PaginaMedicos({ searchParams }: PageProps<"/coordinacion/medicos">) {
  await requerirRol("coordinador_agenda");
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim().slice(0, 80) : "";
  const especialidadId = Number(parametros.especialidad) || undefined;

  const [especialidades, medicos] = await Promise.all([
    db.especialidad.findMany({ orderBy: { nombre: "asc" } }),
    db.medico.findMany({
      where: {
        ...(especialidadId ? { especialidades: { some: { id: especialidadId } } } : {}),
        ...(busqueda
          ? {
              OR: [
                { nombres: { contains: busqueda, mode: "insensitive" } },
                { apellidos: { contains: busqueda, mode: "insensitive" } },
                { registroMedico: { contains: busqueda.toUpperCase() } },
              ],
            }
          : {}),
      },
      include: {
        especialidades: { orderBy: { nombre: "asc" } },
        _count: { select: { disponibilidades: { where: { activo: true } } } },
      },
      orderBy: [{ activo: "desc" }, { apellidos: "asc" }, { nombres: "asc" }],
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Médicos"
        descripcion="Registre los médicos, asócielos a una o más especialidades y configure su disponibilidad semanal."
        acciones={<EnlaceBoton href="/coordinacion/medicos/nuevo">Registrar médico</EnlaceBoton>}
      />

      <form
        role="search"
        className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_16rem_auto] sm:items-end"
      >
        <Campo nombre="q" etiqueta="Nombre o registro médico" type="search" defaultValue={busqueda} />
        <Selector
          nombre="especialidad"
          etiqueta="Especialidad"
          textoVacio="Todas"
          opciones={especialidades.map((especialidad) => ({ valor: especialidad.id, etiqueta: especialidad.nombre }))}
          defaultValue={especialidadId ?? ""}
        />
        <button type="submit" className={clasesBoton("secundario")}>
          Filtrar
        </button>
      </form>

      {medicos.length === 0 ? (
        <EstadoVacio titulo="No hay médicos que coincidan con la búsqueda">
          Cambie los filtros o registre un médico nuevo.
        </EstadoVacio>
      ) : (
        <ContenedorTabla etiqueta="Listado de médicos">
          <thead>
            <tr>
              <th scope="col" className={clasesEncabezadoTabla}>Médico</th>
              <th scope="col" className={clasesEncabezadoTabla}>Especialidades</th>
              <th scope="col" className={clasesEncabezadoTabla}>Bloques semanales</th>
              <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
              <th scope="col" className={clasesEncabezadoTabla}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {medicos.map((medico) => (
              <tr key={medico.id}>
                <td className={clasesCeldaTabla}>
                  <p className="font-semibold">{nombreMedico(medico)}</p>
                  <p className="text-sm text-slate-600">{medico.registroMedico}</p>
                </td>
                <td className={clasesCeldaTabla}>
                  {medico.especialidades.map((especialidad) => especialidad.nombre).join(", ")}
                </td>
                <td className={clasesCeldaTabla}>{medico._count.disponibilidades}</td>
                <td className={clasesCeldaTabla}>
                  {medico.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>}
                </td>
                <td className={clasesCeldaTabla}>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/coordinacion/medicos/${medico.id}`}
                      className="font-semibold text-petroleo-700 underline underline-offset-4"
                    >
                      Editar<span className="sr-only"> a {nombreMedico(medico)}</span>
                    </Link>
                    <Link
                      href={`/coordinacion/disponibilidad?medico=${medico.id}`}
                      className="font-semibold text-petroleo-700 underline underline-offset-4"
                    >
                      Disponibilidad<span className="sr-only"> de {nombreMedico(medico)}</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>
      )}
    </>
  );
}
