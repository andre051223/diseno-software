import { BotonEnviar } from "@/components/ui/boton-enviar";

/** RF-08: botón para activar o inactivar un registro sin borrarlo. */
export function BotonCambioEstado({
  accion,
  id,
  activo,
  nombre,
}: {
  accion: (formData: FormData) => Promise<void>;
  id: number;
  activo: boolean;
  nombre: string;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? "false" : "true"} />
      <BotonEnviar variante={activo ? "secundario" : "primario"} textoEnviando="Guardando…" className="min-w-28">
        {activo ? "Inactivar" : "Activar"}
        <span className="sr-only"> {nombre}</span>
      </BotonEnviar>
    </form>
  );
}
