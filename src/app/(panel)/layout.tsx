import { cerrarSesionAccion } from "@/acciones/autenticacion";
import { Logo } from "@/components/logo";
import { MenuNavegacion } from "@/components/menu-navegacion";
import { PiePagina } from "@/components/pie-pagina";
import { menuPorRol, nombresRoles, inicioDeRol } from "@/lib/roles";
import { requerirRol } from "@/lib/sesion";

// RF-01 y RF-02: cada rol ve únicamente su menú.
export default async function LayoutPanel({ children }: LayoutProps<"/">) {
  const usuario = await requerirRol();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-petroleo-900 text-white no-imprimir">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo href={inicioDeRol(usuario.rol)} claro />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-right leading-tight">
              <span className="block font-semibold">{usuario.nombre}</span>
              <span className="block text-sm text-petroleo-100">{nombresRoles[usuario.rol]}</span>
            </p>
            <form action={cerrarSesionAccion}>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-petroleo-200 px-3 py-2 font-semibold text-white hover:bg-petroleo-700"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <MenuNavegacion elementos={menuPorRol[usuario.rol]} />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <PiePagina />
    </div>
  );
}
