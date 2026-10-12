import type { Metadata } from "next";
import { clasesBoton } from "@/components/ui/boton";
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
import { formatearFechaHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Bitácora" };

const POR_PAGINA = 25;

function Estado({ valor }: { valor: string | null }) {
  if (!valor) return <span className="text-slate-500">—</span>;
  return <code className="block max-w-xs text-xs break-words whitespace-pre-wrap text-slate-800">{valor}</code>;
}

// RF-07 y RF-20: consulta de los cambios registrados con usuario, fecha, hora y estados.
export default async function PaginaBitacora({ searchParams }: PageProps<"/bitacora">) {
  await requerirRol("administrador");
  const parametros = await searchParams;
  const entidad = typeof parametros.entidad === "string" ? parametros.entidad.trim() : "";
  const pagina = leerPagina(parametros.pagina);

  const filtro = entidad ? { entidad: { contains: entidad, mode: "insensitive" as const } } : {};
  const [total, registros] = await Promise.all([
    db.bitacora.count({ where: filtro }),
    db.bitacora.findMany({
      where: filtro,
      include: { usuario: { select: { nombre: true, correo: true } } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Bitácora"
        descripcion="Registro de creaciones, cambios y cancelaciones con el usuario, la fecha y hora y los estados anterior y nuevo."
      />

      <form className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Campo nombre="entidad" etiqueta="Entidad (por ejemplo, Cita, Paciente o Usuario)" defaultValue={entidad} />
        <button type="submit" className={clasesBoton("secundario")}>
          Filtrar
        </button>
      </form>

      {registros.length === 0 ? (
        <EstadoVacio titulo="No hay registros en la bitácora" />
      ) : (
        <ContenedorTabla etiqueta="Registros de la bitácora">
          <thead>
            <tr>
              <th scope="col" className={clasesEncabezadoTabla}>Fecha y hora</th>
              <th scope="col" className={clasesEncabezadoTabla}>Usuario</th>
              <th scope="col" className={clasesEncabezadoTabla}>Entidad</th>
              <th scope="col" className={clasesEncabezadoTabla}>Acción</th>
              <th scope="col" className={clasesEncabezadoTabla}>Estado anterior</th>
              <th scope="col" className={clasesEncabezadoTabla}>Estado nuevo</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id}>
                <td className={`${clasesCeldaTabla} whitespace-nowrap`}>{formatearFechaHora(registro.fecha)}</td>
                <td className={clasesCeldaTabla}>{registro.usuario?.nombre ?? "Sistema"}</td>
                <td className={clasesCeldaTabla}>
                  {registro.entidad}
                  {registro.entidadId ? ` #${registro.entidadId}` : ""}
                </td>
                <td className={clasesCeldaTabla}>{registro.accion.replaceAll("_", " ")}</td>
                <td className={clasesCeldaTabla}>
                  <Estado valor={registro.estadoAnterior} />
                </td>
                <td className={clasesCeldaTabla}>
                  <Estado valor={registro.estadoNuevo} />
                </td>
              </tr>
            ))}
          </tbody>
        </ContenedorTabla>
      )}

      <Paginacion
        pagina={pagina}
        totalPaginas={Math.ceil(total / POR_PAGINA)}
        ruta="/bitacora"
        parametros={{ entidad }}
      />
    </>
  );
}
