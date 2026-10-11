import type { Metadata } from "next";
import Link from "next/link";
import type { EstadoEspacio } from "@/generated/prisma/enums";
import { Alerta } from "@/components/ui/alerta";
import { clasesBoton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import {
  ContenedorTabla,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  Tarjeta,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { configuracion } from "@/lib/configuracion";
import { db } from "@/lib/db";
import { nombreMedico } from "@/lib/etiquetas";
import { formatearFecha, nombresDiasSemana } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { BotonDesactivarBloque, FormularioDisponibilidad, FormularioRegenerar } from "./formularios";

export const metadata: Metadata = { title: "Disponibilidad semanal" };

type Conteo = Partial<Record<EstadoEspacio, number>>;

// RF-10: configuración de la disponibilidad semanal y generación de espacios.
export default async function PaginaDisponibilidad({ searchParams }: PageProps<"/coordinacion/disponibilidad">) {
  await requerirRol("coordinador_agenda");
  const parametros = await searchParams;
  const medicoId = Number(parametros.medico) || undefined;
  const esNuevo = parametros.nuevo === "1";
  const ahora = new Date();

  const medicos = await db.medico.findMany({
    where: { activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    include: { especialidades: { select: { nombre: true } } },
  });
  const medico = medicoId
    ? await db.medico.findUnique({ where: { id: medicoId }, include: { especialidades: true } })
    : null;

  return (
    <>
      <EncabezadoPagina
        titulo="Disponibilidad semanal"
        descripcion={`Configure los días, el horario, la duración de la consulta y el consultorio de cada médico. El sistema genera los espacios de las próximas ${configuracion.semanasGeneracionEspacios} semanas sin cruzarlos con otros espacios del mismo consultorio.`}
      />

      <form className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Selector
          nombre="medico"
          etiqueta="Médico"
          textoVacio="Seleccione un médico"
          opciones={medicos.map((item) => ({
            valor: item.id,
            etiqueta: `${item.apellidos}, ${item.nombres} — ${item.especialidades.map((e) => e.nombre).join(", ")}`,
          }))}
          defaultValue={medicoId ?? ""}
        />
        <button type="submit" className={clasesBoton("secundario")}>
          Ver disponibilidad
        </button>
      </form>

      {!medicoId ? (
        <EstadoVacio titulo="Seleccione un médico para ver y configurar su disponibilidad" />
      ) : !medico ? (
        <Alerta tipo="error">El médico seleccionado no existe.</Alerta>
      ) : (
        <DetalleMedico medico={medico} esNuevo={esNuevo} ahora={ahora} />
      )}
    </>
  );
}

async function DetalleMedico({
  medico,
  esNuevo,
  ahora,
}: {
  medico: { id: number; nombres: string; apellidos: string; activo: boolean; especialidades: { nombre: string }[] };
  esNuevo: boolean;
  ahora: Date;
}) {
  const [bloques, conteos, ultimo, consultorios] = await Promise.all([
    db.disponibilidadSemanal.findMany({
      where: { medicoId: medico.id },
      include: { consultorio: true },
      orderBy: [{ activo: "desc" }, { diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    db.espacio.groupBy({
      by: ["disponibilidadId", "estado"],
      where: { medicoId: medico.id, inicio: { gt: ahora } },
      _count: { _all: true },
    }),
    db.espacio.findFirst({ where: { medicoId: medico.id }, orderBy: { inicio: "desc" }, select: { inicio: true } }),
    db.consultorio.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  const conteoPorBloque = new Map<number, Conteo>();
  for (const fila of conteos) {
    if (fila.disponibilidadId === null) continue;
    const conteo = conteoPorBloque.get(fila.disponibilidadId) ?? {};
    conteo[fila.estado] = fila._count._all;
    conteoPorBloque.set(fila.disponibilidadId, conteo);
  }
  const duracionSugerida = bloques.find((bloque) => bloque.activo)?.duracionMinutos ?? 20;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{nombreMedico(medico)}</h2>
        <p className="text-slate-700">{medico.especialidades.map((especialidad) => especialidad.nombre).join(", ")}</p>
        <p className="text-slate-700">
          {ultimo ? `Espacios generados hasta el ${formatearFecha(ultimo.inicio)}.` : "Aún no tiene espacios generados."}
        </p>
      </div>

      {esNuevo ? (
        <Alerta tipo="exito">El médico quedó registrado. Ahora configure su disponibilidad semanal.</Alerta>
      ) : null}
      {!medico.activo ? (
        <Alerta tipo="advertencia">
          El médico está inactivo: no se le pueden agregar bloques ni generar espacios.{" "}
          <Link href={`/coordinacion/medicos/${medico.id}`} className="font-semibold underline underline-offset-4">
            Editar el médico
          </Link>
        </Alerta>
      ) : null}

      {bloques.length === 0 ? (
        <EstadoVacio titulo="El médico aún no tiene disponibilidad semanal">
          Agregue el primer bloque con el formulario.
        </EstadoVacio>
      ) : (
        <ContenedorTabla etiqueta="Bloques de disponibilidad semanal">
          <thead>
            <tr>
              <th scope="col" className={clasesEncabezadoTabla}>Día</th>
              <th scope="col" className={clasesEncabezadoTabla}>Horario</th>
              <th scope="col" className={clasesEncabezadoTabla}>Duración</th>
              <th scope="col" className={clasesEncabezadoTabla}>Consultorio</th>
              <th scope="col" className={clasesEncabezadoTabla}>Espacios futuros</th>
              <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
              <th scope="col" className={clasesEncabezadoTabla}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bloques.map((bloque) => {
              const conteo = conteoPorBloque.get(bloque.id) ?? {};
              const descripcion = `del ${nombresDiasSemana[bloque.diaSemana].toLowerCase()} de ${bloque.horaInicio} a ${bloque.horaFin}`;
              return (
                <tr key={bloque.id} className={bloque.activo ? undefined : "text-slate-600"}>
                  <td className={clasesCeldaTabla}>{nombresDiasSemana[bloque.diaSemana]}</td>
                  <td className={`${clasesCeldaTabla} whitespace-nowrap`}>
                    {bloque.horaInicio} a {bloque.horaFin}
                  </td>
                  <td className={clasesCeldaTabla}>{bloque.duracionMinutos} min</td>
                  <td className={clasesCeldaTabla}>{bloque.consultorio.nombre}</td>
                  <td className={`${clasesCeldaTabla} text-sm`}>
                    <ul>
                      <li>Libres: {(conteo.libre ?? 0) + (conteo.reservado_temporal ?? 0)}</li>
                      <li>Ocupados: {conteo.ocupado ?? 0}</li>
                      <li>Bloqueados: {conteo.bloqueado ?? 0}</li>
                    </ul>
                  </td>
                  <td className={clasesCeldaTabla}>
                    {bloque.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>}
                  </td>
                  <td className={clasesCeldaTabla}>
                    {bloque.activo ? <BotonDesactivarBloque id={bloque.id} descripcion={descripcion} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ContenedorTabla>
      )}

      {medico.activo ? (
        <>
          {bloques.some((bloque) => bloque.activo) ? (
            <Tarjeta titulo="Mantener la agenda al día">
              <p className="mb-3 text-slate-700">
                Genera los espacios que falten para cubrir las próximas {configuracion.semanasGeneracionEspacios} semanas
                con los bloques activos. Los espacios existentes no se duplican.
              </p>
              <FormularioRegenerar medicoId={medico.id} />
            </Tarjeta>
          ) : null}
          <Tarjeta titulo="Agregar bloque de disponibilidad">
            {consultorios.length === 0 ? (
              <EstadoVacio titulo="No hay consultorios activos">
                <Link href="/coordinacion/consultorios" className="font-semibold text-petroleo-700 underline">
                  Cree o active un consultorio
                </Link>{" "}
                para configurar la disponibilidad.
              </EstadoVacio>
            ) : (
              <FormularioDisponibilidad
                medicoId={medico.id}
                duracionSugerida={duracionSugerida}
                consultorios={consultorios.map((consultorio) => ({
                  valor: consultorio.id,
                  etiqueta: `${consultorio.nombre} (${consultorio.ubicacion})`,
                }))}
              />
            )}
          </Tarjeta>
        </>
      ) : null}
    </div>
  );
}
