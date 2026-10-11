import type { Metadata } from "next";
import Link from "next/link";
import { cambiarEstadoEspecialidadAccion } from "@/acciones/coordinacion";
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
import { FormularioEspecialidad } from "./formulario-especialidad";

export const metadata: Metadata = { title: "Especialidades" };

// RF-08: el coordinador crea, edita e inactiva especialidades.
export default async function PaginaEspecialidades() {
  await requerirRol("coordinador_agenda");
  const especialidades = await db.especialidad.findMany({
    include: { _count: { select: { medicos: { where: { activo: true } } } } },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Especialidades"
        descripcion="Una especialidad inactiva conserva su historial, pero no se ofrece para nuevas citas ni se puede asignar a nuevos médicos."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {especialidades.length === 0 ? (
          <EstadoVacio titulo="Aún no hay especialidades">Cree la primera con el formulario.</EstadoVacio>
        ) : (
          <ContenedorTabla etiqueta="Listado de especialidades">
            <thead>
              <tr>
                <th scope="col" className={clasesEncabezadoTabla}>Especialidad</th>
                <th scope="col" className={clasesEncabezadoTabla}>Médicos activos</th>
                <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
                <th scope="col" className={clasesEncabezadoTabla}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {especialidades.map((especialidad) => (
                <tr key={especialidad.id}>
                  <td className={clasesCeldaTabla}>
                    <p className="font-semibold">{especialidad.nombre}</p>
                    {especialidad.descripcion ? (
                      <p className="text-sm text-slate-600">{especialidad.descripcion}</p>
                    ) : null}
                  </td>
                  <td className={clasesCeldaTabla}>{especialidad._count.medicos}</td>
                  <td className={clasesCeldaTabla}>
                    {especialidad.activo ? (
                      <Insignia tono="exito">Activa</Insignia>
                    ) : (
                      <Insignia tono="neutro">Inactiva</Insignia>
                    )}
                  </td>
                  <td className={clasesCeldaTabla}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/coordinacion/especialidades/${especialidad.id}`}
                        className="font-semibold text-petroleo-700 underline underline-offset-4"
                      >
                        Editar<span className="sr-only"> {especialidad.nombre}</span>
                      </Link>
                      <BotonCambioEstado
                        accion={cambiarEstadoEspecialidadAccion}
                        id={especialidad.id}
                        activo={especialidad.activo}
                        nombre={especialidad.nombre}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        )}
        <Tarjeta titulo="Nueva especialidad">
          <FormularioEspecialidad />
        </Tarjeta>
      </div>
    </>
  );
}
