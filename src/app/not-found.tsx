import { PiePagina } from "@/components/pie-pagina";
import { EnlaceBoton } from "@/components/ui/boton";

export default function NoEncontrado() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="contenido" className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
        <p className="text-sm font-semibold text-petroleo-700">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold">No encontramos esta página</h1>
        <p className="mt-3 text-slate-700">Es posible que la dirección esté mal escrita o que la página ya no exista.</p>
        <div className="mt-6">
          <EnlaceBoton href="/">Ir al inicio</EnlaceBoton>
        </div>
      </main>
      <PiePagina />
    </div>
  );
}
