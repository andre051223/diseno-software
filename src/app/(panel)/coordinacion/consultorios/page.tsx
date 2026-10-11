import type { Metadata } from "next";
import Link from "next/link";
import { cambiarEstadoConsultorioAccion } from "@/acciones/coordinacion";
import { BotonCambioEstado } from "@/components/boton-cambio-estado";
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
import { requerirRol } from "@/lib/sesion";
import { FormularioConsultorio } from "./formulario-consultorio";

export const metadata: Metadata = { title: "Consultorios" };

// RF-08: el coordinador crea, edita e inactiva consultorios.
export default async function PaginaConsultorios() {
  await requerirRol("coordinador_agenda");
  const consultorios = await db.consultorio.findMany({
    include: { _count: { select: { disponibilidades: { where: { activo: true } } } } },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Consultorios"
        descripcion="Un consultorio inactivo no recibe nueva disponibilidad y sus espacios libres no se ofrecen al agendar; las citas ya asignadas se conservan."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {consultorios.length === 0 ? (
          <EstadoVacio titulo="Aún no hay consultorios">Cree el primero con el formulario.</EstadoVacio>
        ) : (
          <ContenedorTabla etiqueta="Listado de consultorios">
            <thead>
              <tr>
                <th scope="col" className={clasesEncabezadoTabla}>Consultorio</th>
                <th scope="col" className={clasesEncabezadoTabla}>Ubicación</th>
                <th scope="col" className={clasesEncabezadoTabla}>Bloques de disponibilidad</th>
                <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
                <th scope="col" className={clasesEncabezadoTabla}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {consultorios.map((consultorio) => (
                <tr key={consultorio.id}>
                  <td className={`${clasesCeldaTabla} font-semibold`}>{consultorio.nombre}</td>
                  <td className={clasesCeldaTabla}>{consultorio.ubicacion}</td>
                  <td className={clasesCeldaTabla}>{consultorio._count.disponibilidades}</td>
                  <td className={clasesCeldaTabla}>
                    {consultorio.activo ? (
                      <Insignia tono="exito">Activo</Insignia>
                    ) : (
                      <Insignia tono="neutro">Inactivo</Insignia>
                    )}
                  </td>
                  <td className={clasesCeldaTabla}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/coordinacion/consultorios/${consultorio.id}`}
                        className="font-semibold text-petroleo-700 underline underline-offset-4"
                      >
                        Editar<span className="sr-only"> {consultorio.nombre}</span>
                      </Link>
                      <BotonCambioEstado
                        accion={cambiarEstadoConsultorioAccion}
                        id={consultorio.id}
                        activo={consultorio.activo}
                        nombre={consultorio.nombre}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        )}
        <Tarjeta titulo="Nuevo consultorio">
          <FormularioConsultorio />
        </Tarjeta>
      </div>
    </>
  );
}
