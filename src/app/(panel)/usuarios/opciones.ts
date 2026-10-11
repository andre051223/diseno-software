import { db } from "@/lib/db";

/** Médicos y pacientes que pueden vincularse a una cuenta (sin cuenta propia, o la cuenta indicada). */
export async function opcionesDeVinculo(usuarioId?: number) {
  const [medicos, pacientes] = await Promise.all([
    db.medico.findMany({
      where: { OR: [{ usuarioId: null }, ...(usuarioId ? [{ usuarioId }] : [])] },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    }),
    db.paciente.findMany({
      where: { OR: [{ usuarioId: null }, ...(usuarioId ? [{ usuarioId }] : [])] },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    }),
  ]);

  return {
    medicos: medicos.map((medico) => ({
      valor: medico.id,
      etiqueta: `${medico.apellidos}, ${medico.nombres} (${medico.registroMedico})`,
    })),
    pacientes: pacientes.map((paciente) => ({
      valor: paciente.id,
      etiqueta: `${paciente.apellidos}, ${paciente.nombres} (${paciente.tipoDocumento} ${paciente.numeroDocumento})`,
    })),
  };
}
