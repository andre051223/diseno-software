import type { Metadata } from "next";
import { ListaCitas } from "@/components/citas/lista-citas";
import { Alerta } from "@/components/ui/alerta";
import { EnlaceBoton } from "@/components/ui/boton";
import { EncabezadoPagina } from "@/components/ui/estructura";
import { requerirRol } from "@/lib/sesion";
import { citasDelPaciente } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Mis citas" };

// Citas del paciente: próximas e historial, con acceso al comprobante, la reprogramación y la cancelación.
export default async function PaginaMisCitas({ searchParams }: PageProps<"/mis-citas">) {
  const usuario = await requerirRol("paciente");
  const { aviso } = await searchParams;

  if (!usuario.pacienteId) {
    return (
      <>
        <EncabezadoPagina titulo="Mis citas" />
        <Alerta tipo="advertencia">
          Su cuenta no está asociada a un registro de paciente. Comuníquese con recepción para completar su registro.
        </Alerta>
      </>
    );
  }

  const { activas, historial } = await citasDelPaciente(usuario.pacienteId);
  const rutaDetalle = (id: number) => `/mis-citas/${id}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Mis citas"
        descripcion="Consulte sus citas, imprima el comprobante, reprográmelas o cancélelas."
        acciones={<EnlaceBoton href="/mis-citas/nueva">Nueva cita</EnlaceBoton>}
      />
      <div className="space-y-8">
        {aviso === "sin-agendar" ? (
          <Alerta tipo="info">No se agendó la cita y el horario quedó libre. Registramos su decisión.</Alerta>
        ) : null}
        <section aria-labelledby="titulo-proximas">
          <h2 id="titulo-proximas" className="mb-4 text-xl font-semibold">
            Próximas citas
          </h2>
          <ListaCitas citas={activas} rutaDetalle={rutaDetalle} vacio="No tiene citas próximas" />
        </section>
        <section aria-labelledby="titulo-historial">
          <h2 id="titulo-historial" className="mb-4 text-xl font-semibold">
            Historial
          </h2>
          <ListaCitas citas={historial} rutaDetalle={rutaDetalle} vacio="Aún no tiene citas en su historial" />
        </section>
      </div>
    </>
  );
}
