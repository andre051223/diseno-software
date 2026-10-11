"use client";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";

/** Mensaje de error de una pantalla con la opción de volver a cargarla. */
export function EstadoError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="space-y-4">
      <Alerta tipo="error" titulo="No pudimos cargar esta pantalla">
        Ocurrió un error inesperado. Intente de nuevo; si el problema continúa, comuníquese con soporte e
        indique el código {error.digest ?? "sin código"}.
      </Alerta>
      <Boton onClick={() => retry()}>Intentar de nuevo</Boton>
    </div>
  );
}
