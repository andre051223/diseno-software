import bcrypt from "bcryptjs";
import type { Rol } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Borra todos los datos de la base de pruebas. */
export async function limpiarBase() {
  await db.notificacion.deleteMany();
  await db.bitacora.deleteMany();
  await db.cita.deleteMany();
  await db.espacio.deleteMany();
  await db.novedad.deleteMany();
  await db.disponibilidadSemanal.deleteMany();
  await db.tokenRecuperacion.deleteMany();
  await db.medico.deleteMany();
  await db.paciente.deleteMany();
  await db.usuario.deleteMany();
  await db.consultorio.deleteMany();
  await db.especialidad.deleteMany();
  await db.aseguradora.deleteMany();
}

let contador = 0;

/** Catálogo mínimo: una aseguradora, una especialidad, dos consultorios y dos médicos. */
export async function crearCatalogoPrueba() {
  contador++;
  const aseguradora = await db.aseguradora.create({
    data: { codigo: `A${contador}`, nombre: `Aseguradora ${contador}` },
  });
  const especialidad = await db.especialidad.create({ data: { nombre: `Especialidad ${contador}` } });
  const consultorioA = await db.consultorio.create({ data: { nombre: `Consultorio A${contador}`, ubicacion: "Piso 1" } });
  const consultorioB = await db.consultorio.create({ data: { nombre: `Consultorio B${contador}`, ubicacion: "Piso 2" } });
  const crearMedico = (sufijo: string) =>
    db.medico.create({
      data: {
        nombres: `Médico ${sufijo}`,
        apellidos: "De Prueba",
        registroMedico: `RM-${contador}${sufijo}`,
        especialidades: { connect: { id: especialidad.id } },
      },
    });
  const medicoA = await crearMedico("A");
  const medicoB = await crearMedico("B");
  return { aseguradora, especialidad, consultorioA, consultorioB, medicoA, medicoB };
}

export async function crearUsuarioPrueba(
  datos: { rol?: Rol; contrasena?: string; activo?: boolean; correo?: string } = {},
) {
  contador++;
  return db.usuario.create({
    data: {
      correo: datos.correo ?? `prueba${contador}@hsr.test`,
      nombre: `Usuario de prueba ${contador}`,
      rol: datos.rol ?? "paciente",
      activo: datos.activo ?? true,
      hashContrasena: await bcrypt.hash(datos.contrasena ?? "Clave1234", 4),
    },
  });
}
