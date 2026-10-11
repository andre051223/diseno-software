import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { actualizarContactoPacienteAccion } from "@/acciones/pacientes";
import { DatosIdentificacion, HistorialContacto } from "@/components/ficha-paciente";
import { ListaCitas } from "@/components/citas/lista-citas";
import { FormularioContacto } from "@/components/formulario-contacto";
import { Alerta } from "@/components/ui/alerta";
import { EnlaceBoton } from "@/components/ui/boton";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { nombrePaciente } from "@/lib/etiquetas";
import { requerirRol } from "@/lib/sesion";
import { citasDelPaciente } from "@/servicios/agendamiento";
import { historialContacto } from "@/servicios/pacientes";

export const metadata: Metadata = { title: "Ficha del paciente" };

const avisosRegistro: Record<string, string> = {
  "con-cuenta":
    "El paciente quedó registrado. Le enviamos al correo un enlace para que cree la contraseña de su cuenta en el portal.",
  "sin-cuenta":
    "El paciente quedó registrado. Su correo ya pertenece a otra cuenta del portal, así que no se le creó acceso propio; puede agendar en ventanilla o por teléfono.",
};

// RF-07: ficha del paciente con actualización de contacto e historial de cambios.
// También lista sus citas para reprogramarlas o cancelarlas (RF-16, RF-17) y agendar otras.
export default async function PaginaPaciente({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  await requerirRol("recepcionista", "agente_telefonico");
  const { id } = await params;
  const { registrado } = await searchParams;
  const paciente = await db.paciente.findUnique({
    where: { id: Number(id) || 0 },
    include: { aseguradora: true },
  });
  if (!paciente) notFound();

  const [cambios, citas] = await Promise.all([historialContacto(paciente.id), citasDelPaciente(paciente.id)]);
  const rutaDetalle = (citaId: number) => `/citas/${citaId}`;
  const aviso = typeof registrado === "string" ? avisosRegistro[registrado] : undefined;

  return (
    <>
      <Link href="/pacientes" className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4">
        ← Volver a pacientes
      </Link>
      <EncabezadoPagina
        titulo={nombrePaciente(paciente)}
        descripcion={
          paciente.usuarioId ? (
            <Insignia tono="exito">Con cuenta en el portal</Insignia>
          ) : (
            <Insignia tono="neutro">Sin cuenta en el portal</Insignia>
          )
        }
        acciones={<EnlaceBoton href={`/agendar?paciente=${paciente.id}`}>Agendar cita</EnlaceBoton>}
      />
      <div className="space-y-6">
        {aviso ? <Alerta tipo="exito">{aviso}</Alerta> : null}
        <section aria-labelledby="titulo-citas">
          <h2 id="titulo-citas" className="mb-4 text-xl font-semibold">
            Próximas citas
          </h2>
          <ListaCitas citas={citas.activas} rutaDetalle={rutaDetalle} vacio="El paciente no tiene citas próximas" />
        </section>
        <Tarjeta titulo="Datos de identificación">
          <DatosIdentificacion paciente={paciente} />
        </Tarjeta>
        <Tarjeta titulo="Datos de contacto">
          <FormularioContacto
            accion={actualizarContactoPacienteAccion}
            pacienteId={paciente.id}
            telefono={paciente.telefono}
            correo={paciente.correo}
            ayudaCorreo={paciente.usuarioId ? "También es el correo con el que el paciente inicia sesión." : undefined}
          />
        </Tarjeta>
        <section>
          <h2 className="mb-4 text-xl font-semibold">Historial de cambios de contacto</h2>
          <HistorialContacto cambios={cambios} />
        </section>
        <section aria-labelledby="titulo-historial-citas">
          <h2 id="titulo-historial-citas" className="mb-4 text-xl font-semibold">
            Historial de citas
          </h2>
          <ListaCitas citas={citas.historial} rutaDetalle={rutaDetalle} vacio="El paciente aún no tiene citas en su historial" />
        </section>
      </div>
    </>
  );
}
