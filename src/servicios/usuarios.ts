import { db } from "@/lib/db";
import type { DatosCrearCuenta, DatosEditarCuenta } from "@/lib/validaciones/usuarios";
import { cifrarContrasena } from "./autenticacion";
import { registrarBitacora } from "./bitacora";

type Resultado = { ok: true; id: number } | { ok: false; mensaje: string; campo?: string };

function resumenCuenta(cuenta: { nombre: string; rol: string; activo: boolean; correo: string }) {
  return { nombre: cuenta.nombre, correo: cuenta.correo, rol: cuenta.rol, activo: cuenta.activo };
}

/** RF-02: crea una cuenta y le asigna uno de los siete roles. */
export async function crearCuenta(datos: DatosCrearCuenta, actorId: number): Promise<Resultado> {
  const existente = await db.usuario.findUnique({ where: { correo: datos.correo } });
  if (existente) {
    return { ok: false, mensaje: "Ya existe una cuenta con ese correo.", campo: "correo" };
  }

  const verificacion = await verificarVinculo(datos.rol, datos.medicoId, datos.pacienteId, null);
  if (verificacion) return verificacion;

  const hashContrasena = await cifrarContrasena(datos.contrasena);

  const cuenta = await db.$transaction(async (tx) => {
    const nueva = await tx.usuario.create({
      data: { nombre: datos.nombre, correo: datos.correo, rol: datos.rol, hashContrasena },
    });
    if (datos.rol === "medico" && datos.medicoId) {
      await tx.medico.update({ where: { id: datos.medicoId }, data: { usuarioId: nueva.id } });
    }
    if (datos.rol === "paciente" && datos.pacienteId) {
      await tx.paciente.update({ where: { id: datos.pacienteId }, data: { usuarioId: nueva.id } });
    }
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Usuario",
        entidadId: nueva.id,
        accion: "crear_cuenta",
        estadoNuevo: resumenCuenta(nueva),
      },
      tx,
    );
    return nueva;
  });

  return { ok: true, id: cuenta.id };
}

/** RF-02: modifica el nombre, el rol o el estado de una cuenta. */
export async function editarCuenta(datos: DatosEditarCuenta, actorId: number): Promise<Resultado> {
  const anterior = await db.usuario.findUnique({
    where: { id: datos.id },
    include: { medico: true, paciente: true },
  });
  if (!anterior) return { ok: false, mensaje: "La cuenta no existe." };

  if (anterior.id === actorId && (datos.rol !== "administrador" || !datos.activo)) {
    return {
      ok: false,
      mensaje: "No puede quitarse a sí mismo el rol de administrador ni inactivar su propia cuenta.",
    };
  }

  const verificacion = await verificarVinculo(datos.rol, datos.medicoId, datos.pacienteId, anterior.id);
  if (verificacion) return verificacion;

  await db.$transaction(async (tx) => {
    // Se quitan los vínculos que ya no correspondan al rol nuevo.
    if (anterior.medico && (datos.rol !== "medico" || anterior.medico.id !== datos.medicoId)) {
      await tx.medico.update({ where: { id: anterior.medico.id }, data: { usuarioId: null } });
    }
    if (anterior.paciente && (datos.rol !== "paciente" || anterior.paciente.id !== datos.pacienteId)) {
      await tx.paciente.update({ where: { id: anterior.paciente.id }, data: { usuarioId: null } });
    }
    if (datos.rol === "medico" && datos.medicoId) {
      await tx.medico.update({ where: { id: datos.medicoId }, data: { usuarioId: anterior.id } });
    }
    if (datos.rol === "paciente" && datos.pacienteId) {
      await tx.paciente.update({ where: { id: datos.pacienteId }, data: { usuarioId: anterior.id } });
    }

    const actualizada = await tx.usuario.update({
      where: { id: anterior.id },
      data: {
        nombre: datos.nombre,
        rol: datos.rol,
        activo: datos.activo,
        ...(datos.desbloquear ? { intentosFallidos: 0, bloqueadoHasta: null } : {}),
      },
    });

    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Usuario",
        entidadId: anterior.id,
        accion: "editar_cuenta",
        estadoAnterior: resumenCuenta(anterior),
        estadoNuevo: { ...resumenCuenta(actualizada), desbloqueada: datos.desbloquear },
      },
      tx,
    );
  });

  return { ok: true, id: anterior.id };
}

async function verificarVinculo(
  rol: string,
  medicoId: number | null,
  pacienteId: number | null,
  usuarioId: number | null,
): Promise<Resultado | null> {
  if (rol === "medico" && medicoId) {
    const medico = await db.medico.findUnique({ where: { id: medicoId } });
    if (!medico) return { ok: false, mensaje: "El médico no existe.", campo: "medicoId" };
    if (medico.usuarioId && medico.usuarioId !== usuarioId) {
      return { ok: false, mensaje: "Ese médico ya tiene una cuenta asociada.", campo: "medicoId" };
    }
  }
  if (rol === "paciente" && pacienteId) {
    const paciente = await db.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) return { ok: false, mensaje: "El paciente no existe.", campo: "pacienteId" };
    if (paciente.usuarioId && paciente.usuarioId !== usuarioId) {
      return { ok: false, mensaje: "Ese paciente ya tiene una cuenta asociada.", campo: "pacienteId" };
    }
  }
  return null;
}
