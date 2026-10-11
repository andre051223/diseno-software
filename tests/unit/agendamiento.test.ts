import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { esErrorUnico } from "@/lib/errores-db";
import { esquemaBusquedaEspacios, esquemaCancelacion } from "@/lib/validaciones/citas";
import {
  buscarEspaciosLibres,
  canalSegunRol,
  cancelarCita,
  crearCita,
  evaluarCambio,
  liberarReservasVencidas,
  reprogramarCita,
  reservarEspacio,
  type DatosNuevaCita,
} from "@/servicios/agendamiento";
import { debeDemorarse, evaluarCobertura } from "@/servicios/aseguradora-simulada";
import { consultarCobertura, reintentarCoberturaCita, type ConsultorAseguradora } from "@/servicios/cobertura";
import { crearCatalogoPrueba, crearUsuarioPrueba, limpiarBase } from "./ayudantes";

// Lunes 12 de octubre de 2026, 08:00 en Bogotá.
const AHORA = new Date("2026-10-12T13:00:00Z");
const enHoras = (horas: number) => new Date(AHORA.getTime() + horas * 3_600_000);
const enMinutos = (minutos: number) => new Date(AHORA.getTime() + minutos * 60_000);

let catalogo: Awaited<ReturnType<typeof crearCatalogoPrueba>>;
let pacienteUsuarioId: number;
let otroUsuarioId: number;
let pacienteId: number;
let otroPacienteId: number;

let contadorDocumento = 0;
async function crearPaciente(usuarioId: number | null = null, terminacion = "3") {
  contadorDocumento++;
  return db.paciente.create({
    data: {
      tipoDocumento: "CC",
      numeroDocumento: `5200${contadorDocumento}${terminacion}`,
      nombres: "Paciente",
      apellidos: `De Prueba ${contadorDocumento}`,
      fechaNacimiento: new Date("1985-05-05T05:00:00Z"),
      telefono: "3001234567",
      correo: `paciente${contadorDocumento}@correo.test`,
      aseguradoraId: catalogo.aseguradora.id,
      usuarioId,
    },
  });
}

async function crearEspacio(inicio: Date, cambios: { medicoId?: number; consultorioId?: number } = {}) {
  return db.espacio.create({
    data: {
      medicoId: cambios.medicoId ?? catalogo.medicoA.id,
      consultorioId: cambios.consultorioId ?? catalogo.consultorioA.id,
      inicio,
      fin: new Date(inicio.getTime() + 30 * 60_000),
    },
  });
}

function datosCita(espacioId: number, cambios: Partial<DatosNuevaCita> = {}): DatosNuevaCita {
  return {
    pacienteId,
    espacioId,
    especialidadId: catalogo.especialidad.id,
    canal: "portal_web",
    creadaPorId: pacienteUsuarioId,
    resultadoCobertura: "cubierta",
    detalleCobertura: "Afiliación vigente.",
    esParticular: false,
    ...cambios,
  };
}

beforeEach(async () => {
  await limpiarBase();
  catalogo = await crearCatalogoPrueba();
  pacienteUsuarioId = (await crearUsuarioPrueba()).id;
  otroUsuarioId = (await crearUsuarioPrueba()).id;
  pacienteId = (await crearPaciente(pacienteUsuarioId)).id;
  otroPacienteId = (await crearPaciente(otroUsuarioId)).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("RF-12: espacios libres filtrados", () => {
  it("muestra solo los espacios libres de la especialidad, el médico y el rango de fechas", async () => {
    const libre = await crearEspacio(enHoras(2));
    const otroMedico = await crearEspacio(enHoras(3), { medicoId: catalogo.medicoB.id, consultorioId: catalogo.consultorioB.id });
    const ocupado = await crearEspacio(enHoras(4));
    await db.espacio.update({ where: { id: ocupado.id }, data: { estado: "ocupado" } });
    const bloqueado = await crearEspacio(enHoras(5));
    await db.espacio.update({ where: { id: bloqueado.id }, data: { estado: "bloqueado" } });
    const pasado = await crearEspacio(enHoras(-2));
    const fueraDeRango = await crearEspacio(enHoras(24 * 5));

    const filtro = { especialidadId: catalogo.especialidad.id, desde: "2026-10-12", hasta: "2026-10-14" };
    const todos = await buscarEspaciosLibres(filtro, pacienteUsuarioId, AHORA);
    const ids = todos.espacios.map((espacio) => espacio.id);
    expect(ids).toEqual([libre.id, otroMedico.id]);
    expect(ids).not.toContain(pasado.id);
    expect(ids).not.toContain(fueraDeRango.id);

    const soloMedicoB = await buscarEspaciosLibres({ ...filtro, medicoId: catalogo.medicoB.id }, pacienteUsuarioId, AHORA);
    expect(soloMedicoB.espacios.map((espacio) => espacio.id)).toEqual([otroMedico.id]);

    const otraEspecialidad = await db.especialidad.create({ data: { nombre: "Sin médicos" } });
    const vacio = await buscarEspaciosLibres({ ...filtro, especialidadId: otraEspecialidad.id }, pacienteUsuarioId, AHORA);
    expect(vacio.total).toBe(0);
  });

  it("no ofrece espacios de consultorios o médicos inactivos", async () => {
    await crearEspacio(enHoras(2));
    await db.consultorio.update({ where: { id: catalogo.consultorioA.id }, data: { activo: false } });
    const resultado = await buscarEspaciosLibres(
      { especialidadId: catalogo.especialidad.id, desde: "2026-10-12", hasta: "2026-10-12" },
      pacienteUsuarioId,
      AHORA,
    );
    expect(resultado.total).toBe(0);
  });

  it("valida que el rango de fechas sea coherente", () => {
    expect(esquemaBusquedaEspacios.safeParse({ especialidad: "1", desde: "2026-10-20", hasta: "2026-10-12" }).success).toBe(false);
    expect(esquemaBusquedaEspacios.safeParse({ especialidad: "1", desde: "2026-10-12", hasta: "2027-03-01" }).success).toBe(false);
    expect(esquemaBusquedaEspacios.safeParse({ especialidad: "1", desde: "2026-10-12", hasta: "2026-10-20" }).success).toBe(true);
  });
});

describe("RF-14: reserva temporal de cinco minutos", () => {
  it("bloquea el espacio a los demás y lo libera automáticamente al vencer", async () => {
    const espacio = await crearEspacio(enHoras(2));
    const especialidadId = catalogo.especialidad.id;

    const primera = await reservarEspacio(espacio.id, especialidadId, pacienteUsuarioId, AHORA);
    expect(primera).toMatchObject({ ok: true, reservadoHasta: enMinutos(5) });

    // Mientras la reserva está vigente, nadie más puede tomarla ni verla como libre.
    expect(await reservarEspacio(espacio.id, especialidadId, otroUsuarioId, enMinutos(4))).toMatchObject({ ok: false });
    const filtro = { especialidadId, desde: "2026-10-12", hasta: "2026-10-12" };
    expect((await buscarEspaciosLibres(filtro, otroUsuarioId, enMinutos(4))).total).toBe(0);
    // Quien reservó sí la sigue viendo.
    expect((await buscarEspaciosLibres(filtro, pacienteUsuarioId, enMinutos(4))).total).toBe(1);

    // Al vencer, el espacio vuelve a estar disponible aunque la tarea programada no haya corrido.
    expect((await buscarEspaciosLibres(filtro, otroUsuarioId, enMinutos(6))).total).toBe(1);
    expect(await reservarEspacio(espacio.id, especialidadId, otroUsuarioId, enMinutos(6))).toMatchObject({ ok: true });
  });

  it("la tarea programada devuelve a libre las reservas vencidas", async () => {
    const espacio = await crearEspacio(enHoras(2));
    await reservarEspacio(espacio.id, catalogo.especialidad.id, pacienteUsuarioId, AHORA);
    expect(await liberarReservasVencidas(enMinutos(3))).toBe(0);
    expect(await liberarReservasVencidas(enMinutos(6))).toBe(1);
    const liberado = await db.espacio.findUniqueOrThrow({ where: { id: espacio.id } });
    expect(liberado).toMatchObject({ estado: "libre", reservadoHasta: null, reservadoPorId: null });
  });

  it("al reservar otro horario se suelta la reserva anterior del mismo usuario", async () => {
    const primero = await crearEspacio(enHoras(2));
    const segundo = await crearEspacio(enHoras(3));
    await reservarEspacio(primero.id, catalogo.especialidad.id, pacienteUsuarioId, AHORA);
    await reservarEspacio(segundo.id, catalogo.especialidad.id, pacienteUsuarioId, AHORA);
    expect((await db.espacio.findUniqueOrThrow({ where: { id: primero.id } })).estado).toBe("libre");
    expect((await db.espacio.findUniqueOrThrow({ where: { id: segundo.id } })).estado).toBe("reservado_temporal");
  });
});

describe("RF-13: no se asigna un espacio con cita activa", () => {
  it("rechaza una segunda cita en el mismo espacio", async () => {
    const espacio = await crearEspacio(enHoras(2));
    const primera = await crearCita(datosCita(espacio.id), AHORA);
    expect(primera.ok).toBe(true);
    const segunda = await crearCita(
      datosCita(espacio.id, { pacienteId: otroPacienteId, creadaPorId: otroUsuarioId }),
      AHORA,
    );
    expect(segunda).toMatchObject({ ok: false, codigo: "no-disponible" });
    expect(await db.cita.count()).toBe(1);
  });

  it("dos reservas simultáneas del mismo espacio terminan con una sola cita", async () => {
    const espacio = await crearEspacio(enHoras(2));
    const resultados = await Promise.all([
      crearCita(datosCita(espacio.id), AHORA),
      crearCita(datosCita(espacio.id, { pacienteId: otroPacienteId, creadaPorId: otroUsuarioId }), AHORA),
    ]);
    expect(resultados.filter((resultado) => resultado.ok)).toHaveLength(1);
    expect(await db.cita.count({ where: { espacioId: espacio.id } })).toBe(1);
    expect((await db.espacio.findUniqueOrThrow({ where: { id: espacio.id } })).estado).toBe("ocupado");
  });

  it("la base de datos rechaza dos citas activas en el mismo espacio aunque se salte la lógica", async () => {
    const espacio = await crearEspacio(enHoras(2));
    const base = {
      espacioId: espacio.id,
      espacioActivoId: espacio.id,
      especialidadId: catalogo.especialidad.id,
      canal: "ventanilla" as const,
      creadaPorId: pacienteUsuarioId,
    };
    await db.cita.create({ data: { ...base, codigo: "HSR-AAAAAA", pacienteId, tokenRespuesta: "t1" } });
    const error = await db.cita
      .create({ data: { ...base, codigo: "HSR-BBBBBB", pacienteId: otroPacienteId, tokenRespuesta: "t2" } })
      .catch((causa: unknown) => causa);
    expect(esErrorUnico(error)).toBe(true);
  });

  it("no toma un espacio que otra persona tiene reservado", async () => {
    const espacio = await crearEspacio(enHoras(2));
    await reservarEspacio(espacio.id, catalogo.especialidad.id, otroUsuarioId, AHORA);
    expect(await crearCita(datosCita(espacio.id), enMinutos(1))).toMatchObject({ ok: false, codigo: "no-disponible" });
  });
});

describe("RF-15, RF-19 y RF-20: código, canal y bitácora de la creación", () => {
  it("genera un código legible, guarda canal y creador y deja la creación en la bitácora", async () => {
    const espacio = await crearEspacio(enHoras(2));
    const recepcionista = await crearUsuarioPrueba({ rol: "recepcionista" });
    const resultado = await crearCita(
      datosCita(espacio.id, { canal: canalSegunRol("recepcionista"), creadaPorId: recepcionista.id }),
      AHORA,
    );
    if (!resultado.ok) throw new Error(resultado.mensaje);
    expect(resultado.codigo).toMatch(/^HSR-[2-9A-HJ-NP-Z]{6}$/);

    const cita = await db.cita.findUniqueOrThrow({ where: { id: resultado.citaId } });
    expect(cita).toMatchObject({ canal: "ventanilla", creadaPorId: recepcionista.id, estado: "agendada" });
    expect(canalSegunRol("agente_telefonico")).toBe("telefono");
    expect(canalSegunRol("paciente")).toBe("portal_web");

    const registro = await db.bitacora.findFirstOrThrow({ where: { accion: "crear_cita", entidadId: String(cita.id) } });
    expect(registro.usuarioId).toBe(recepcionista.id);
    expect(JSON.parse(registro.estadoNuevo!)).toMatchObject({ estado: "agendada", canal: "ventanilla" });
  });
});

describe("RF-18: una sola cita activa por especialidad", () => {
  it("rechaza una segunda cita activa del paciente en la misma especialidad", async () => {
    const primero = await crearEspacio(enHoras(30));
    const segundo = await crearEspacio(enHoras(50));
    const creada = await crearCita(datosCita(primero.id), AHORA);
    expect(await crearCita(datosCita(segundo.id), AHORA)).toMatchObject({ ok: false, codigo: "cita-activa" });

    // Otro paciente sí puede tomar el segundo espacio.
    expect(await crearCita(datosCita(segundo.id, { pacienteId: otroPacienteId }), AHORA)).toMatchObject({ ok: true });

    // Si cancela la primera, puede volver a agendar en la especialidad.
    if (!creada.ok) throw new Error(creada.mensaje);
    await cancelarCita({ citaId: creada.citaId, motivo: "Viaje fuera de la ciudad", actorId: pacienteUsuarioId, rol: "paciente" }, AHORA);
    const tercero = await crearEspacio(enHoras(70));
    expect(await crearCita(datosCita(tercero.id), AHORA)).toMatchObject({ ok: true });
  });

  it("permite una cita activa en otra especialidad", async () => {
    const otra = await db.especialidad.create({ data: { nombre: "Otra especialidad" } });
    await db.medico.update({ where: { id: catalogo.medicoB.id }, data: { especialidades: { connect: { id: otra.id } } } });
    const primero = await crearEspacio(enHoras(30));
    const segundo = await crearEspacio(enHoras(30), { medicoId: catalogo.medicoB.id, consultorioId: catalogo.consultorioB.id });
    expect(await crearCita(datosCita(primero.id), AHORA)).toMatchObject({ ok: true });
    expect(await crearCita(datosCita(segundo.id, { especialidadId: otra.id }), AHORA)).toMatchObject({ ok: true });
  });
});

describe("RF-16: reprogramación en una sola transacción", () => {
  it("libera el espacio original, asigna el nuevo y conserva el código", async () => {
    const original = await crearEspacio(enHoras(30));
    const nuevo = await crearEspacio(enHoras(50));
    const creada = await crearCita(datosCita(original.id), AHORA);
    if (!creada.ok) throw new Error(creada.mensaje);
    await db.cita.update({ where: { id: creada.citaId }, data: { estado: "confirmada" } });

    await reservarEspacio(nuevo.id, catalogo.especialidad.id, pacienteUsuarioId, AHORA);
    const resultado = await reprogramarCita(
      { citaId: creada.citaId, espacioId: nuevo.id, actorId: pacienteUsuarioId, rol: "paciente" },
      AHORA,
    );
    expect(resultado).toEqual({ ok: true });

    const cita = await db.cita.findUniqueOrThrow({ where: { id: creada.citaId } });
    expect(cita).toMatchObject({ codigo: creada.codigo, espacioId: nuevo.id, espacioActivoId: nuevo.id, estado: "agendada" });
    expect((await db.espacio.findUniqueOrThrow({ where: { id: original.id } })).estado).toBe("libre");
    expect((await db.espacio.findUniqueOrThrow({ where: { id: nuevo.id } })).estado).toBe("ocupado");

    const registro = await db.bitacora.findFirstOrThrow({ where: { accion: "reprogramar_cita" } });
    expect(JSON.parse(registro.estadoAnterior!)).toMatchObject({ estado: "confirmada", espacioId: original.id });
    expect(JSON.parse(registro.estadoNuevo!)).toMatchObject({ estado: "agendada", espacioId: nuevo.id });
  });

  it("si el nuevo espacio ya está ocupado no cambia nada", async () => {
    const original = await crearEspacio(enHoras(30));
    const ocupado = await crearEspacio(enHoras(50));
    const creada = await crearCita(datosCita(original.id), AHORA);
    await crearCita(datosCita(ocupado.id, { pacienteId: otroPacienteId, creadaPorId: otroUsuarioId }), AHORA);
    if (!creada.ok) throw new Error(creada.mensaje);

    const resultado = await reprogramarCita(
      { citaId: creada.citaId, espacioId: ocupado.id, actorId: pacienteUsuarioId, rol: "paciente" },
      AHORA,
    );
    expect(resultado).toMatchObject({ ok: false, codigo: "no-disponible" });
    const cita = await db.cita.findUniqueOrThrow({ where: { id: creada.citaId } });
    expect(cita.espacioId).toBe(original.id);
    expect((await db.espacio.findUniqueOrThrow({ where: { id: original.id } })).estado).toBe("ocupado");
  });

  it("un espacio original que cae en una novedad sigue bloqueado", async () => {
    const original = await crearEspacio(enHoras(30));
    const nuevo = await crearEspacio(enHoras(50));
    const creada = await crearCita(datosCita(original.id), AHORA);
    if (!creada.ok) throw new Error(creada.mensaje);
    const novedad = await db.novedad.create({
      data: { medicoId: catalogo.medicoA.id, tipo: "incapacidad", inicio: enHoras(29), fin: enHoras(31) },
    });
    await db.espacio.update({ where: { id: original.id }, data: { estado: "bloqueado", novedadId: novedad.id } });

    await reprogramarCita({ citaId: creada.citaId, espacioId: nuevo.id, actorId: pacienteUsuarioId, rol: "paciente" }, AHORA);
    expect((await db.espacio.findUniqueOrThrow({ where: { id: original.id } })).estado).toBe("bloqueado");
  });
});

describe("RF-17: cancelación con 24 horas de anticipación", () => {
  it("el paciente cancela con más de 24 horas, se libera el espacio y se guarda el motivo", async () => {
    const espacio = await crearEspacio(enHoras(30));
    const creada = await crearCita(datosCita(espacio.id), AHORA);
    if (!creada.ok) throw new Error(creada.mensaje);

    const resultado = await cancelarCita(
      { citaId: creada.citaId, motivo: "Cruce con compromiso laboral", actorId: pacienteUsuarioId, rol: "paciente" },
      AHORA,
    );
    expect(resultado).toEqual({ ok: true });
    const cita = await db.cita.findUniqueOrThrow({ where: { id: creada.citaId } });
    expect(cita).toMatchObject({ estado: "cancelada", motivoCancelacion: "Cruce con compromiso laboral", espacioActivoId: null });
    expect((await db.espacio.findUniqueOrThrow({ where: { id: espacio.id } })).estado).toBe("libre");

    const registro = await db.bitacora.findFirstOrThrow({ where: { accion: "cancelar_cita" } });
    expect(JSON.parse(registro.estadoAnterior!)).toMatchObject({ estado: "agendada" });
    expect(JSON.parse(registro.estadoNuevo!)).toMatchObject({ estado: "cancelada" });

    // El espacio liberado vuelve a ofrecerse.
    const libres = await buscarEspaciosLibres(
      { especialidadId: catalogo.especialidad.id, desde: "2026-10-12", hasta: "2026-10-14" },
      otroUsuarioId,
      AHORA,
    );
    expect(libres.espacios.map((item) => item.id)).toContain(espacio.id);
  });

  it("con menos de 24 horas el paciente debe comunicarse con recepción", async () => {
    const espacio = await crearEspacio(enHoras(10));
    const creada = await crearCita(datosCita(espacio.id), AHORA);
    if (!creada.ok) throw new Error(creada.mensaje);

    const resultado = await cancelarCita(
      { citaId: creada.citaId, motivo: "Calamidad doméstica", actorId: pacienteUsuarioId, rol: "paciente" },
      AHORA,
    );
    expect(resultado).toMatchObject({ ok: false, codigo: "requiere-recepcion" });
    if (!resultado.ok) expect(resultado.mensaje).toMatch(/comuníquese con recepción/);
    expect((await db.cita.findUniqueOrThrow({ where: { id: creada.citaId } })).estado).toBe("agendada");

    // La recepcionista sí puede cancelarla.
    const recepcionista = await crearUsuarioPrueba({ rol: "recepcionista" });
    expect(
      await cancelarCita(
        { citaId: creada.citaId, motivo: "Calamidad doméstica", actorId: recepcionista.id, rol: "recepcionista" },
        AHORA,
      ),
    ).toEqual({ ok: true });
  });

  it("evalúa el límite exacto de 24 horas y las citas que ya no se pueden modificar", () => {
    expect(evaluarCambio({ estado: "agendada", inicio: enHoras(24) }, "paciente", AHORA)).toEqual({ permitido: true });
    expect(evaluarCambio({ estado: "agendada", inicio: enMinutos(24 * 60 - 1) }, "paciente", AHORA)).toMatchObject({
      permitido: false,
      motivo: "requiere-recepcion",
    });
    expect(evaluarCambio({ estado: "en_sala", inicio: enHoras(48) }, "recepcionista", AHORA)).toMatchObject({
      permitido: false,
      motivo: "no-modificable",
    });
    expect(evaluarCambio({ estado: "agendada", inicio: enHoras(-1) }, "recepcionista", AHORA)).toMatchObject({
      permitido: false,
    });
  });

  it("exige el motivo de la cancelación", () => {
    expect(esquemaCancelacion.safeParse({ citaId: "1", motivo: "  " }).success).toBe(false);
    expect(esquemaCancelacion.safeParse({ citaId: "1", motivo: "Viaje de trabajo" }).success).toBe(true);
  });
});

describe("RF-21 a RF-23: validación de cobertura", () => {
  const solicitud = { tipoDocumento: "CC", aseguradora: "Salud Andina EPS", especialidad: "Cardiología" };

  it("la aseguradora simulada responde de forma determinista según el documento", () => {
    expect(evaluarCobertura({ ...solicitud, numeroDocumento: "52000370" })).toMatchObject({ vigente: false });
    expect(evaluarCobertura({ ...solicitud, numeroDocumento: "52000378" })).toMatchObject({ vigente: true, cubierta: false });
    expect(evaluarCobertura({ ...solicitud, numeroDocumento: "52000378", especialidad: "Medicina general" })).toMatchObject({
      cubierta: true,
    });
    expect(evaluarCobertura({ ...solicitud, numeroDocumento: "52000373" })).toMatchObject({ vigente: true, cubierta: true });
    expect(debeDemorarse({ ...solicitud, numeroDocumento: "52000379" })).toBe(true);
    expect(debeDemorarse({ ...solicitud, numeroDocumento: "52000379", reintento: true })).toBe(false);
  });

  it("traduce la respuesta y marca «sin respuesta» si se agota el tiempo de espera", async () => {
    const rapido: ConsultorAseguradora = async (datos) => evaluarCobertura(datos);
    const lento: ConsultorAseguradora = () => new Promise(() => {});
    const caido: ConsultorAseguradora = async () => {
      throw new Error("Servicio no disponible");
    };

    expect(await consultarCobertura({ ...solicitud, numeroDocumento: "1" }, rapido)).toMatchObject({ resultado: "cubierta" });
    expect(await consultarCobertura({ ...solicitud, numeroDocumento: "10" }, rapido)).toMatchObject({ resultado: "sin_vigencia" });
    expect(await consultarCobertura({ ...solicitud, numeroDocumento: "18" }, rapido)).toMatchObject({ resultado: "sin_cobertura" });
    expect(await consultarCobertura({ ...solicitud, numeroDocumento: "19" }, lento, 50)).toMatchObject({ resultado: "sin_respuesta" });
    expect(await consultarCobertura({ ...solicitud, numeroDocumento: "13" }, caido)).toMatchObject({ resultado: "sin_respuesta" });
  });

  it("RF-22: sin vigencia solo se agenda como particular", async () => {
    const espacio = await crearEspacio(enHoras(30));
    const sinDecision = await crearCita(datosCita(espacio.id, { resultadoCobertura: "sin_vigencia" }), AHORA);
    expect(sinDecision.ok).toBe(false);
    expect((await db.espacio.findUniqueOrThrow({ where: { id: espacio.id } })).estado).toBe("libre");

    const particular = await crearCita(datosCita(espacio.id, { resultadoCobertura: "sin_vigencia", esParticular: true }), AHORA);
    if (!particular.ok) throw new Error(particular.mensaje);
    const cita = await db.cita.findUniqueOrThrow({ where: { id: particular.citaId } });
    expect(cita).toMatchObject({ estado: "agendada", esParticular: true, resultadoCobertura: "sin_vigencia" });
    expect(cita.detalleCobertura).toMatch(/decidió agendar como particular/);
  });

  it("RF-23: sin respuesta queda pendiente de validación y el reintento la confirma", async () => {
    const espacio = await crearEspacio(enHoras(30));
    const creada = await crearCita(
      datosCita(espacio.id, { resultadoCobertura: "sin_respuesta", detalleCobertura: "Sin respuesta." }),
      AHORA,
    );
    if (!creada.ok) throw new Error(creada.mensaje);
    expect(creada.estado).toBe("pendiente_validacion");

    const rapido: ConsultorAseguradora = async (datos) => evaluarCobertura(datos);
    expect(await reintentarCoberturaCita(creada.citaId, rapido)).toBe("cubierta");
    const cita = await db.cita.findUniqueOrThrow({ where: { id: creada.citaId } });
    expect(cita).toMatchObject({ estado: "agendada", resultadoCobertura: "cubierta", intentosCobertura: 2 });
    expect(await db.bitacora.count({ where: { accion: "reintentar_cobertura" } })).toBe(1);

    // Una cita que ya no está pendiente no se vuelve a consultar.
    expect(await reintentarCoberturaCita(creada.citaId, rapido)).toBeNull();
  });
});
