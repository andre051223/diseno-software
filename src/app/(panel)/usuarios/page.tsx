import type { Metadata } from "next";
import Link from "next/link";
import type { Rol } from "@/generated/prisma/enums";
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
import { formatearFechaHora } from "@/lib/fechas";
import { listaRoles, nombresRoles } from "@/lib/roles";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Usuarios y roles" };

// RF-02: listado de cuentas con su rol y estado.
export default async function PaginaUsuarios({ searchParams }: PageProps<"/usuarios">) {
  await requerirRol("administrador");
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim() : "";
  const rol = listaRoles.includes(parametros.rol as Rol) ? (parametros.rol as Rol) : undefined;
  const ahora = new Date();

  const cuentas = await db.usuario.findMany({
    where: {
      ...(rol ? { rol } : {}),
      ...(busqueda
        ? { OR: [{ nombre: { contains: busqueda } }, { correo: { contains: busqueda.toLowerCase() } }] }
        : {}),
    },
    orderBy: [{ rol: "asc" }, { nombre: "asc" }],
    take: 200,
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios y roles"
        descripcion="Cree cuentas, asigne uno de los siete roles y active o inactive el acceso."
        acciones={<EnlaceBoton href="/usuarios/nueva">Nueva cuenta</EnlaceBoton>}
      />

      <form className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_16rem_auto] sm:items-end">
        <Campo nombre="q" etiqueta="Buscar por nombre o correo" defaultValue={busqueda} type="search" />
        <Selector
          nombre="rol"
          etiqueta="Rol"
          textoVacio="Todos los roles"
          opciones={listaRoles.map((valor) => ({ valor, etiqueta: nombresRoles[valor] }))}
          defaultValue={rol ?? ""}
        />
        <button type="submit" className={clasesBoton("secundario")}>
          Filtrar
        </button>
      </form>

      {cuentas.length === 0 ? (
        <EstadoVacio titulo="No hay cuentas que coincidan con la búsqueda">
          Cambie los filtros o cree una cuenta nueva.
        </EstadoVacio>
      ) : (
        <ContenedorTabla etiqueta="Listado de cuentas">
          <thead>
            <tr>
              <th scope="col" className={clasesEncabezadoTabla}>Nombre</th>
              <th scope="col" className={clasesEncabezadoTabla}>Correo</th>
              <th scope="col" className={clasesEncabezadoTabla}>Rol</th>
              <th scope="col" className={clasesEncabezadoTabla}>Estado</th>
              <th scope="col" className={clasesEncabezadoTabla}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((cuenta) => {
              const bloqueada = cuenta.bloqueadoHasta && cuenta.bloqueadoHasta > ahora;
              return (
                <tr key={cuenta.id}>
                  <td className={clasesCeldaTabla}>{cuenta.nombre}</td>
                  <td className={`${clasesCeldaTabla} break-all`}>{cuenta.correo}</td>
                  <td className={clasesCeldaTabla}>{nombresRoles[cuenta.rol]}</td>
                  <td className={clasesCeldaTabla}>
                    {!cuenta.activo ? (
                      <Insignia tono="neutro">Inactiva</Insignia>
                    ) : bloqueada ? (
                      <Insignia tono="peligro">Bloqueada hasta {formatearFechaHora(cuenta.bloqueadoHasta!)}</Insignia>
                    ) : (
                      <Insignia tono="exito">Activa</Insignia>
                    )}
                  </td>
                  <td className={clasesCeldaTabla}>
                    <Link
                      href={`/usuarios/${cuenta.id}`}
                      className="font-semibold text-petroleo-700 underline underline-offset-4"
                    >
                      Editar<span className="sr-only"> la cuenta de {cuenta.nombre}</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ContenedorTabla>
      )}
    </>
  );
}
