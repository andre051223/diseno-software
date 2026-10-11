import type { Metadata } from "next";
import { actualizarMisDatosAccion } from "@/acciones/pacientes";
import { DatosIdentificacion, HistorialContacto } from "@/components/ficha-paciente";
import { FormularioContacto } from "@/components/formulario-contacto";
import { Alerta } from "@/components/ui/alerta";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";
import { historialContacto } from "@/servicios/pacientes";

export const metadata: Metadata = { title: "Mis datos" };

// RF-07: el paciente consulta sus datos y actualiza su información de contacto.
export default async function PaginaMisDatos() {
  const usuario = await requerirRol("paciente");
  const paciente = usuario.pacienteId
    ? await db.paciente.findUnique({ where: { id: usuario.pacienteId }, include: { aseguradora: true } })
    : null;

  if (!paciente) {
    return (
      <>
        <EncabezadoPagina titulo="Mis datos" />
        <Alerta tipo="advertencia">
          Su cuenta no está asociada a un registro de paciente. Comuníquese con recepción para completar su registro.
        </Alerta>
      </>
    );
  }

  const cambios = await historialContacto(paciente.id);

  return (
    <>
      <EncabezadoPagina
        titulo="Mis datos"
        descripcion="Mantenga actualizados su teléfono y su correo: allí le enviamos las confirmaciones y los recordatorios de sus citas."
      />
      <div className="space-y-6">
        <Tarjeta titulo="Datos de identificación">
          <DatosIdentificacion paciente={paciente} />
          <p className="mt-4 text-sm text-slate-600">
            Para corregir su documento, nombres, fecha de nacimiento o aseguradora, acérquese a recepción con su
            documento de identidad.
          </p>
        </Tarjeta>
        <Tarjeta titulo="Datos de contacto">
          <FormularioContacto
            accion={actualizarMisDatosAccion}
            telefono={paciente.telefono}
            correo={paciente.correo}
            ayudaCorreo="También es el correo con el que inicia sesión."
          />
        </Tarjeta>
        <section>
          <h2 className="mb-4 text-xl font-semibold">Historial de cambios</h2>
          <HistorialContacto cambios={cambios} />
        </section>
      </div>
    </>
  );
}
