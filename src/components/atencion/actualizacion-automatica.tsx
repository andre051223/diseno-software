"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * RF-29: vuelve a pedir los datos de la página al servidor cada cierto tiempo, sin recargar
 * el navegador. `actualizadoEn` lo calcula el servidor en cada actualización.
 */
export function ActualizacionAutomatica({ segundos = 30, actualizadoEn }: { segundos?: number; actualizadoEn: string }) {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(intervalo);
  }, [router, segundos]);

  return (
    <p className="text-sm text-slate-600">
      La lista se actualiza sola cada {segundos} segundos · última actualización: {actualizadoEn}.
    </p>
  );
}
