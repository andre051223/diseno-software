"use client";

import { useEffect, useState } from "react";

function formatear(segundos: number) {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
}

/**
 * RF-14: tiempo que queda de la reserva temporal del horario. Al vencer, avisa que el
 * horario se liberó para otras personas.
 */
export function CuentaRegresiva({ hasta, alVencer }: { hasta: string; alVencer?: React.ReactNode }) {
  const limite = new Date(hasta).getTime();
  const [restantes, setRestantes] = useState<number | null>(null);

  useEffect(() => {
    const actualizar = () => setRestantes(Math.max(0, Math.round((limite - Date.now()) / 1000)));
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [limite]);

  if (restantes === 0) {
    return (
      <div role="alert" className="rounded-lg border-l-4 border-red-700 bg-red-50 p-4 text-red-900">
        <p className="font-semibold">La reserva del horario venció</p>
        <div className="mt-1">{alVencer ?? "El horario quedó disponible para otras personas. Vuelva a elegir un horario."}</div>
      </div>
    );
  }

  return (
    <p className="rounded-lg border border-petroleo-200 bg-petroleo-50 p-3 text-petroleo-900">
      Le reservamos este horario mientras completa la cita. Tiempo restante:{" "}
      <strong role="timer" aria-live="off">
        {restantes === null ? "—" : formatear(restantes)}
      </strong>{" "}
      minutos.
    </p>
  );
}
