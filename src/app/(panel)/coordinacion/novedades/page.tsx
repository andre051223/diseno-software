import type { Metadata } from "next";
import Link from "next/link";
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
import { db } from "@/lib/db";
import { nombreMedico, nombresTipoNovedad } from "@/lib/etiquetas";
import { aFechaIso, formatearFechaHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { FormularioNovedad } from "./formulario-novedad";

export const metadata: Metadata = { title: "Novedades" };

const POR_PAGINA = 15;

// RF-11: registro y consulta de novedades de los médicos.
export default async function PaginaNovedades({ searchParams }: PageProps<"/coordinacion/novedades">) {
  await requerirRol("coordinador_agenda");
  const parametros = await searchParams;
  const pagina = leerPagina(parametros.pagina);
  const medicoInicial = Number(parametros.medico) || undefined;
  const ahora = new Date();

  const [medicos, total, novedades] = await Promise.all([
    db.medico.findMany({ where: { activo: true }, orderBy: [{ apellidos: "asc" }, { nombres: "asc" }] }),
    db.novedad.count(),
    db.novedad.findMany({
      include: { medico: true, _count: { select: { espacios: true } } },
      orderBy: [{ inicio: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Novedades"
        descripcion="Al registrar vacaciones, incapacidades o capacitaciones, los espacios del médico en ese periodo se bloquean y se listan las citas ya asignadas."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section aria-labelledby="titulo-novedades">
          <h2 id="titulo-novedades" className="sr-only">
            Novedades registradas
          </h2>
          {novedades.length === 0 ? (
            <EstadoVacio titulo="No hay novedades registradas" />
          ) : (
            <ContenedorTabla etiqueta="Novedades registradas">
              <thead>
                <tr>
                  <th scope="col" className={clasesEncabezadoTabla}>Médico</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Tipo</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Periodo</th>
                  <th scope="col" className={clasesEncabezadoTabla}>Espacios bloqueados</th>
                  <th scope="col" className={clasesEncabezadoTabla}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {novedades.map((novedad) => {
                  const vigente = novedad.inicio <= ahora && novedad.fin > ahora;
                  const pasada = novedad.fin <= ahora;
                  return (
                    <tr key={novedad.id}>
                      <td className={clasesCeldaTabla}>{nombreMedico(novedad.medico)}</td>
                      <td className={clasesCeldaTabla}>
                        <p>{nombresTipoNovedad[novedad.tipo]}</p>
                        {vigente ? <Insignia tono="advertencia">En curso</Insignia> : null}
                        {pasada ? <Insignia tono="neutro">Finalizada</Insignia> : null}
                      </td>
                      <td className={`${clasesCeldaTabla} whitespace-nowrap`}>
                        <p>Desde {formatearFechaHora(novedad.inicio)}</p>
                        <p>Hasta {formatearFechaHora(novedad.fin)}</p>
                      </td>
                      <td className={clasesCeldaTabla}>{novedad._count.espacios}</td>
                      <td className={clasesCeldaTabla}>
                        <Link
                          href={`/coordinacion/novedades/${novedad.id}`}
                          className="font-semibold text-petroleo-700 underline underline-offset-4"
                        >
                          Ver detalle<span className="sr-only"> de la novedad de {nombreMedico(novedad.medico)}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ContenedorTabla>
          )}
          <Paginacion
            pagina={pagina}
            totalPaginas={Math.ceil(total / POR_PAGINA)}
            ruta="/coordinacion/novedades"
            parametros={{}}
          />
        </section>

        <Tarjeta titulo="Nueva novedad">
          {medicos.length === 0 ? (
            <EstadoVacio titulo="No hay médicos activos" />
          ) : (
            <FormularioNovedad
              hoy={aFechaIso(ahora)}
              medicoInicial={medicoInicial}
              medicos={medicos.map((medico) => ({
                valor: medico.id,
                etiqueta: `${medico.apellidos}, ${medico.nombres}`,
              }))}
            />
          )}
        </Tarjeta>
      </div>
    </>
  );
}
