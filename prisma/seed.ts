/**
 * Datos de prueba del sistema de citas del Hospital Central San Rafael.
 *
 * Crea 12 especialidades, 10 consultorios, 24 médicos con disponibilidad semanal,
 * 3 aseguradoras, 60 pacientes, un usuario por rol y citas pasadas, del día y
 * futuras en todos los estados para que los reportes tengan información.
 *
 * Es determinista (usa un generador pseudoaleatorio con semilla fija) y puede
 * ejecutarse varias veces: borra los datos anteriores antes de crearlos.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type {
  CanalOrigen,
  EstadoCita,
  ResultadoCobertura,
  Rol,
  TipoDocumento,
} from "../src/generated/prisma/enums";
import { generarCodigoCita, generarTokenRespuesta } from "../src/lib/codigos";
import { configuracion } from "../src/lib/configuracion";
import { aFechaIso, crearFechaBogota, diaSemanaIso } from "../src/lib/fechas";
import { calcularEspacios, sumarDiasIso } from "../src/servicios/generador-espacios";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/** Contraseña de todas las cuentas de prueba (documentada en el README). */
const CONTRASENA_PRUEBA = "Hospital2026";

// ---------------------------------------------------------------------------
// Generador pseudoaleatorio con semilla (mulberry32) para datos reproducibles.
// ---------------------------------------------------------------------------
let estadoAleatorio = 20261010;
function aleatorio(): number {
  estadoAleatorio |= 0;
  estadoAleatorio = (estadoAleatorio + 0x6d2b79f5) | 0;
  let t = Math.imul(estadoAleatorio ^ (estadoAleatorio >>> 15), 1 | estadoAleatorio);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entero = (maximo: number) => Math.floor(aleatorio() * maximo);
const elegir = <T,>(lista: readonly T[]): T => lista[entero(lista.length)];
function elegirPonderado<T>(opciones: readonly [T, number][]): T {
  const total = opciones.reduce((suma, [, peso]) => suma + peso, 0);
  let tirada = aleatorio() * total;
  for (const [valor, peso] of opciones) {
    tirada -= peso;
    if (tirada <= 0) return valor;
  }
  return opciones[opciones.length - 1][0];
}
const minutos = (cantidad: number) => cantidad * 60_000;

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
const especialidades = [
  { nombre: "Medicina general", duracion: 20, ocupacion: 0.8, descripcion: "Consulta de atención primaria." },
  { nombre: "Pediatría", duracion: 20, ocupacion: 0.75, descripcion: "Atención de niños y adolescentes." },
  { nombre: "Ginecología", duracion: 30, ocupacion: 0.65, descripcion: "Salud de la mujer." },
  { nombre: "Medicina interna", duracion: 30, ocupacion: 0.7, descripcion: "Enfermedades del adulto." },
  { nombre: "Cardiología", duracion: 30, ocupacion: 0.6, descripcion: "Corazón y sistema circulatorio." },
  { nombre: "Dermatología", duracion: 30, ocupacion: 0.5, descripcion: "Piel, cabello y uñas." },
  { nombre: "Ortopedia", duracion: 30, ocupacion: 0.55, descripcion: "Huesos, músculos y articulaciones." },
  { nombre: "Oftalmología", duracion: 30, ocupacion: 0.45, descripcion: "Salud visual." },
  { nombre: "Otorrinolaringología", duracion: 30, ocupacion: 0.4, descripcion: "Oído, nariz y garganta." },
  { nombre: "Psiquiatría", duracion: 40, ocupacion: 0.5, descripcion: "Salud mental." },
  { nombre: "Neurología", duracion: 30, ocupacion: 0.45, descripcion: "Sistema nervioso." },
  { nombre: "Endocrinología", duracion: 30, ocupacion: 0.35, descripcion: "Hormonas y metabolismo." },
] as const;

const aseguradoras = [
  { codigo: "SAN", nombre: "Salud Andina EPS" },
  { codigo: "PRV", nombre: "Previsalud Colombia" },
  { codigo: "MCP", nombre: "Medicuidar Prepagada" },
];

const consultorios = [
  ...[101, 102, 103, 104, 105].map((numero) => ({
    nombre: `Consultorio ${numero}`,
    ubicacion: "Bloque A, piso 1",
  })),
  ...[201, 202, 203, 204, 205].map((numero) => ({
    nombre: `Consultorio ${numero}`,
    ubicacion: "Bloque B, piso 2",
  })),
];

const nombresMedicos = [
  ["Laura Marcela", "Gómez Restrepo"],
  ["Andrés Felipe", "Rodríguez Peña"],
  ["Catalina", "Martínez Ospina"],
  ["Juan Sebastián", "López Cárdenas"],
  ["Diana Patricia", "Herrera Quintero"],
  ["Santiago", "Ramírez Mejía"],
  ["Paola Andrea", "Castro Villamizar"],
  ["Camilo Ernesto", "Torres Salazar"],
  ["María José", "Vargas Lozano"],
  ["Ricardo", "Moreno Guzmán"],
  ["Natalia", "Jiménez Arango"],
  ["Felipe Andrés", "Rojas Becerra"],
  ["Adriana", "Sánchez Duarte"],
  ["Mauricio", "Díaz Pineda"],
  ["Luisa Fernanda", "Ortiz Cifuentes"],
  ["Germán Darío", "Muñoz Valencia"],
  ["Carolina", "Navarro Escobar"],
  ["Óscar Iván", "Ruiz Montoya"],
  ["Valentina", "Suárez Carrillo"],
  ["Héctor Julio", "Peña Zapata"],
  ["Ángela María", "Cortés Barrera"],
  ["Jorge Enrique", "Silva Rincón"],
  ["Mónica Alejandra", "Reyes Parra"],
  ["Esteban", "Molina Acosta"],
];

const nombresPacientes = [
  "Ana", "Carlos", "Sofía", "Daniel", "Isabella", "Mateo", "Gabriela", "Nicolás", "Mariana", "Julián",
  "Valeria", "Samuel", "Daniela", "Alejandro", "Sara", "David", "Juliana", "Tomás", "Manuela", "Emilio",
  "Lucía", "Martín", "Paula", "Sebastián", "Antonia", "Joaquín", "Camila", "Miguel Ángel", "Laura", "Simón",
];
const apellidosPacientes = [
  "García", "Rodríguez", "Martínez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres",
  "Flórez", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Ortiz", "Gutiérrez", "Chávez", "Ramos",
  "Castaño", "Bermúdez", "Agudelo", "Londoño", "Quiñones", "Benítez", "Aristizábal", "Ibáñez", "Peñaloza", "Zúñiga",
];

const motivosCancelacion = [
  "Viaje fuera de la ciudad",
  "Cruce con compromiso laboral",
  "Mejoría de los síntomas",
  "Calamidad doméstica",
  "Prefiere otro horario",
];

const ESTADOS_QUE_OCUPAN: EstadoCita[] = [
  "agendada",
  "confirmada",
  "pendiente_validacion",
  "en_sala",
  "atendida",
  "inasistencia",
];
const ESTADOS_ACTIVOS: EstadoCita[] = ["agendada", "confirmada", "pendiente_validacion", "en_sala"];

function quitarTildes(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function correoDe(nombre: string, apellido: string, indice: number) {
  const base = quitarTildes(`${nombre.split(" ")[0]}.${apellido.split(" ")[0]}`).toLowerCase();
  return `${base}${indice}@correo.test`;
}

async function enLotes<T>(elementos: T[], tamano: number, accion: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < elementos.length; i += tamano) {
    await accion(elementos.slice(i, i + tamano));
  }
}

async function limpiar() {
  // Borra todos los datos y reinicia los contadores de identificadores para que los datos sean predecibles.
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "Notificacion", "Bitacora", "Cita", "Espacio", "Novedad", "DisponibilidadSemanal",
      "TokenRecuperacion", "_EspecialidadToMedico", "Medico", "Paciente", "Usuario", "Consultorio",
      "Especialidad", "Aseguradora" RESTART IDENTITY CASCADE`,
  );
}

async function main() {
  const ahora = new Date();
  console.log("Limpiando datos anteriores…");
  await limpiar();

  const hash = await bcrypt.hash(CONTRASENA_PRUEBA, 10);

  // --- Catálogos -----------------------------------------------------------
  console.log("Creando catálogos…");
  const aseguradorasDb = [];
  for (const aseguradora of aseguradoras) {
    aseguradorasDb.push(await db.aseguradora.create({ data: aseguradora }));
  }
  const especialidadesDb = [];
  for (const especialidad of especialidades) {
    especialidadesDb.push(
      await db.especialidad.create({
        data: { nombre: especialidad.nombre, descripcion: especialidad.descripcion },
      }),
    );
  }
  const consultoriosDb = [];
  for (const consultorio of consultorios) {
    consultoriosDb.push(await db.consultorio.create({ data: consultorio }));
  }

  // --- Usuarios internos (uno por rol) --------------------------------------
  console.log("Creando usuarios por rol…");
  const crearUsuario = (correo: string, nombre: string, rol: Rol) =>
    db.usuario.create({ data: { correo, nombre, rol, hashContrasena: hash } });

  const administrador = await crearUsuario("admin@hsr.test", "Beatriz Salcedo", "administrador");
  await crearUsuario("coordinacion@hsr.test", "Fernando Uribe", "coordinador_agenda");
  await crearUsuario("direccion@hsr.test", "Dra. Elena Cárdenas", "director_medico");
  const recepcionista = await crearUsuario("recepcion@hsr.test", "Marta Lucía Prieto", "recepcionista");
  const agente = await crearUsuario("callcenter@hsr.test", "Jhon Fredy Ayala", "agente_telefonico");

  // --- Médicos y disponibilidad ---------------------------------------------
  console.log("Creando médicos y disponibilidad semanal…");
  // Diez consultorios × dos turnos = 20 posiciones. Los médicos 0 a 15 ocupan una
  // posición de lunes a viernes; los médicos 16 a 23 comparten cuatro posiciones
  // (unos lunes, miércoles y viernes; otros martes y jueves).
  const turnos = [
    { horaInicio: "07:00", horaFin: "12:00" },
    { horaInicio: "13:00", horaFin: "18:00" },
  ];
  const posiciones = consultoriosDb.flatMap((consultorio) =>
    turnos.map((turno) => ({ consultorioId: consultorio.id, ...turno })),
  );
  // Las posiciones se reparten para que médicos de la misma especialidad no queden en el mismo turno.
  const ordenPosiciones = [0, 3, 4, 7, 8, 11, 12, 15, 16, 19, 1, 2, 5, 6, 9, 10];

  type MedicoCreado = { id: number; especialidadIds: number[]; duracion: number };
  const medicos: MedicoCreado[] = [];

  for (let i = 0; i < 24; i++) {
    const [nombres, apellidos] = nombresMedicos[i];
    const especialidadPrincipal = especialidadesDb[Math.floor(i / 2)];
    const especialidadIds = [especialidadPrincipal.id];
    // Los internistas también atienden medicina general (relación muchos a muchos).
    if (especialidadPrincipal.nombre === "Medicina interna") especialidadIds.push(especialidadesDb[0].id);

    const medico = await db.medico.create({
      data: {
        nombres,
        apellidos,
        registroMedico: `RM-${10001 + i}`,
        correo: `${quitarTildes(nombres.split(" ")[0]).toLowerCase()}.${quitarTildes(apellidos.split(" ")[0]).toLowerCase()}@hsr.test`,
        telefono: `310${String(5550000 + i).padStart(7, "0")}`,
        especialidades: { connect: especialidadIds.map((id) => ({ id })) },
      },
    });
    const duracion = especialidades[Math.floor(i / 2)].duracion;
    medicos.push({ id: medico.id, especialidadIds, duracion });

    let posicion;
    let dias: number[];
    if (i < 16) {
      posicion = posiciones[ordenPosiciones[i]];
      dias = [1, 2, 3, 4, 5];
    } else {
      const compartidas = [13, 14, 17, 18];
      posicion = posiciones[compartidas[Math.floor((i - 16) / 2)]];
      dias = i % 2 === 0 ? [1, 3, 5] : [2, 4];
    }
    for (const diaSemana of dias) {
      await db.disponibilidadSemanal.create({
        data: {
          medicoId: medico.id,
          consultorioId: posicion.consultorioId,
          diaSemana,
          horaInicio: posicion.horaInicio,
          horaFin: posicion.horaFin,
          duracionMinutos: duracion,
        },
      });
    }
    // Medicina general y pediatría también atienden los sábados en la mañana.
    if (i < 4) {
      await db.disponibilidadSemanal.create({
        data: {
          medicoId: medico.id,
          consultorioId: consultoriosDb[i].id,
          diaSemana: 6,
          horaInicio: "07:00",
          horaFin: "13:00",
          duracionMinutos: duracion,
        },
      });
    }
  }

  const usuarioMedico = await crearUsuario("medico@hsr.test", "Dra. Laura Marcela Gómez Restrepo", "medico");
  await db.medico.update({ where: { id: medicos[0].id }, data: { usuarioId: usuarioMedico.id } });

  // --- Espacios: seis semanas atrás y las próximas ocho semanas ---------------
  console.log("Generando espacios…");
  const hoyIso = aFechaIso(ahora);
  const desplazamientoLunes = diaSemanaIso(crearFechaBogota(hoyIso, "12:00")) - 1;
  const desde = crearFechaBogota(sumarDiasIso(hoyIso, -desplazamientoLunes - 42), "00:00");
  const hasta = crearFechaBogota(sumarDiasIso(hoyIso, configuracion.semanasGeneracionEspacios * 7), "23:59");

  const disponibilidades = await db.disponibilidadSemanal.findMany();
  const espaciosNuevos = disponibilidades.flatMap((bloque) =>
    calcularEspacios(bloque, desde, hasta).map((intervalo) => ({
      medicoId: bloque.medicoId,
      consultorioId: bloque.consultorioId,
      disponibilidadId: bloque.id,
      inicio: intervalo.inicio,
      fin: intervalo.fin,
    })),
  );
  await enLotes(espaciosNuevos, 1000, (lote) => db.espacio.createMany({ data: lote }));
  const espacios = await db.espacio.findMany({ orderBy: { inicio: "asc" } });
  console.log(`  ${espacios.length} espacios creados.`);

  // --- Pacientes --------------------------------------------------------------
  console.log("Creando pacientes…");
  type PacienteCreado = { id: number; usuarioId: number; documento: string };
  const pacientes: PacienteCreado[] = [];
  for (let i = 0; i < 60; i++) {
    const nombre = nombresPacientes[i % nombresPacientes.length];
    const apellido1 = apellidosPacientes[i % apellidosPacientes.length];
    const apellido2 = apellidosPacientes[(i * 7 + 3) % apellidosPacientes.length];
    const esMenor = i % 9 === 4;
    const tipoDocumento: TipoDocumento = esMenor ? "TI" : i % 13 === 7 ? "CE" : "CC";
    // El último dígito del documento determina la respuesta simulada de la aseguradora:
    // 0 = sin afiliación vigente, 9 = la aseguradora tarda más de 10 segundos.
    const ultimoDigito = i === 0 ? 3 : i % 10;
    const numeroDocumento = `${esMenor ? 1100 + i : 52000 + i * 37}${String(100 + i).slice(-2)}${ultimoDigito}`;
    const edad = esMenor ? 6 + entero(10) : 19 + entero(60);
    const fechaNacimiento = crearFechaBogota(
      `${ahora.getFullYear() - edad}-${String(1 + entero(12)).padStart(2, "0")}-${String(1 + entero(28)).padStart(2, "0")}`,
      "00:00",
    );
    const nombreCompleto = `${nombre} ${apellido1} ${apellido2}`;
    const correo = i === 0 ? "paciente@hsr.test" : correoDe(nombre, apellido1, i);

    const usuario = await crearUsuario(correo, nombreCompleto, "paciente");
    const paciente = await db.paciente.create({
      data: {
        tipoDocumento,
        numeroDocumento,
        nombres: nombre,
        apellidos: `${apellido1} ${apellido2}`,
        fechaNacimiento,
        telefono: `3${String(100000000 + i * 1234567).slice(0, 9)}`,
        correo,
        aseguradoraId: aseguradorasDb[i % 3].id,
        usuarioId: usuario.id,
      },
    });
    pacientes.push({ id: paciente.id, usuarioId: usuario.id, documento: numeroDocumento });
  }

  // --- Citas --------------------------------------------------------------------
  console.log("Creando citas…");
  const medicoPorId = new Map(medicos.map((medico) => [medico.id, medico]));
  const especialidadPorId = new Map(especialidadesDb.map((e, i) => [e.id, especialidades[i]]));
  const codigos = new Set<string>();
  const activasPorPacienteEspecialidad = new Set<string>();
  const horariosPorPaciente = new Set<string>();
  const citas: Prisma.CitaCreateManyInput[] = [];
  const espaciosOcupados: number[] = [];

  const inicioHoy = crearFechaBogota(hoyIso, "00:00");
  const finHoy = crearFechaBogota(sumarDiasIso(hoyIso, 1), "00:00");
  let citasFuturas = 0;
  const MAXIMO_FUTURAS = 150;

  for (const espacio of espacios) {
    const medico = medicoPorId.get(espacio.medicoId)!;
    const especialidadId = elegir(medico.especialidadIds);
    const perfil = especialidadPorId.get(especialidadId)!;
    const esPasado = espacio.fin <= inicioHoy;
    const esHoy = espacio.inicio >= inicioHoy && espacio.inicio < finHoy;
    const esFuturo = espacio.inicio >= finHoy;

    // Probabilidad de que el espacio tenga cita según la especialidad y el periodo.
    let probabilidad: number = perfil.ocupacion;
    if (esHoy) probabilidad = 0.55;
    // Pocas citas futuras para que siempre haya espacios libres en las demostraciones.
    if (esFuturo) probabilidad = citasFuturas < MAXIMO_FUTURAS ? 0.06 : 0;
    if (aleatorio() > probabilidad) continue;

    // Paciente: se buscan candidatos que no tengan otra cita a la misma hora
    // ni (para citas activas) otra cita activa en la misma especialidad (RF-18).
    let estado: EstadoCita;
    if (esPasado) {
      estado = elegirPonderado<EstadoCita>([
        ["atendida", 66],
        ["inasistencia", 16],
        ["cancelada", 18],
      ]);
    } else if (esHoy) {
      const yaPaso = espacio.inicio.getTime() + minutos(configuracion.minutosParaInasistencia) < ahora.getTime();
      const enCurso = espacio.inicio <= ahora && !yaPaso;
      estado = yaPaso
        ? elegirPonderado<EstadoCita>([
            ["atendida", 75],
            ["inasistencia", 15],
            ["cancelada", 10],
          ])
        : enCurso
          ? "en_sala"
          : elegirPonderado<EstadoCita>([
              ["confirmada", 60],
              ["agendada", 30],
              ["cancelada", 10],
            ]);
    } else {
      estado = elegirPonderado<EstadoCita>([
        ["agendada", 45],
        ["confirmada", 35],
        ["pendiente_validacion", 8],
        ["cancelada", 12],
      ]);
    }

    let paciente: PacienteCreado | undefined;
    for (let intento = 0; intento < 12 && !paciente; intento++) {
      // El paciente de demostración (índice 0) se deja sin citas futuras para que pueda agendar libremente,
      // y el índice 1 se reserva para la cita de demostración del registro de llegada.
      const candidato = pacientes[2 + entero(pacientes.length - 2)];
      const claveHorario = `${candidato.id}-${espacio.inicio.getTime()}`;
      const claveActiva = `${candidato.id}-${especialidadId}`;
      if (horariosPorPaciente.has(claveHorario)) continue;
      if (ESTADOS_ACTIVOS.includes(estado) && activasPorPacienteEspecialidad.has(claveActiva)) continue;
      // Documentos que terminan en 9: la aseguradora no responde, la cita queda pendiente.
      if (estado === "pendiente_validacion" && !candidato.documento.endsWith("9")) continue;
      paciente = candidato;
      horariosPorPaciente.add(claveHorario);
      if (ESTADOS_ACTIVOS.includes(estado)) activasPorPacienteEspecialidad.add(claveActiva);
    }
    if (!paciente) continue;

    const canal = elegirPonderado<CanalOrigen>([
      ["ventanilla", 30],
      ["telefono", 32],
      ["portal_web", 28],
      ["aplicacion_movil", 10],
    ]);
    const creadaPorId =
      canal === "ventanilla" ? recepcionista.id : canal === "telefono" ? agente.id : paciente.usuarioId;

    // La solicitud se hizo entre 1 y 20 días antes de la cita, nunca después de hoy.
    const diasAnticipacion = 1 + entero(20);
    let fechaSolicitud = new Date(espacio.inicio.getTime() - diasAnticipacion * 86_400_000 - minutos(entero(600)));
    if (fechaSolicitud > ahora) fechaSolicitud = new Date(ahora.getTime() - minutos(30 + entero(600)));

    // Cobertura: documentos terminados en 0 no tienen afiliación vigente y se atienden como particulares.
    let resultadoCobertura: ResultadoCobertura = "cubierta";
    let esParticular = false;
    let detalleCobertura = "Afiliación vigente con cobertura para la especialidad.";
    if (paciente.documento.endsWith("0")) {
      resultadoCobertura = "sin_vigencia";
      esParticular = true;
      detalleCobertura = "Sin afiliación vigente. El paciente decidió agendar como particular.";
    }
    if (estado === "pendiente_validacion") {
      resultadoCobertura = "sin_respuesta";
      detalleCobertura = "La aseguradora no respondió en el tiempo máximo. Validación en reintento.";
    }

    let codigo = generarCodigoCita(entero);
    while (codigos.has(codigo)) codigo = generarCodigoCita(entero);
    codigos.add(codigo);

    let horaLlegada: Date | null = null;
    let inicioAtencion: Date | null = null;
    let finAtencion: Date | null = null;
    if (estado === "atendida" || estado === "en_sala") {
      horaLlegada = new Date(espacio.inicio.getTime() - minutos(entero(25)));
      if (horaLlegada > ahora) horaLlegada = new Date(ahora.getTime() - minutos(1));
    }
    if (estado === "atendida") {
      const espera = entero(25);
      inicioAtencion = new Date(Math.max(espacio.inicio.getTime(), horaLlegada!.getTime()) + minutos(espera));
      finAtencion = new Date(inicioAtencion.getTime() + minutos(Math.max(10, medico.duracion - 5 + entero(10))));
    }

    const ocupa = ESTADOS_QUE_OCUPAN.includes(estado);
    citas.push({
      codigo,
      pacienteId: paciente.id,
      espacioId: espacio.id,
      espacioActivoId: ocupa ? espacio.id : null,
      especialidadId,
      estado,
      canal,
      creadaPorId,
      motivoCancelacion: estado === "cancelada" ? elegir(motivosCancelacion) : null,
      fechaSolicitud,
      horaLlegada,
      inicioAtencion,
      finAtencion,
      resultadoCobertura,
      detalleCobertura,
      esParticular,
      intentosCobertura: estado === "pendiente_validacion" ? 1 : 0,
      tokenRespuesta: generarTokenRespuesta(),
      creadoEn: fechaSolicitud,
    });
    if (ocupa) espaciosOcupados.push(espacio.id);
    if (esFuturo) citasFuturas++;
  }

  // Si la semilla se ejecuta fuera del horario de atención no surge ninguna cita "en sala";
  // se toma la última cita atendida y se deja como paciente que llegó y espera ser atendido.
  if (!citas.some((cita) => cita.estado === "en_sala")) {
    const ultimaAtendida = [...citas].reverse().find((cita) => cita.estado === "atendida");
    if (ultimaAtendida) {
      ultimaAtendida.estado = "en_sala";
      ultimaAtendida.inicioAtencion = null;
      ultimaAtendida.finAtencion = null;
    }
  }

  await enLotes(citas, 500, (lote) => db.cita.createMany({ data: lote }));
  await enLotes(espaciosOcupados, 500, (lote) =>
    db.espacio.updateMany({ where: { id: { in: lote } }, data: { estado: "ocupado" } }),
  );

  // --- Cita de demostración del registro de llegada (RF-28 a RF-30) ---------------
  // El segundo paciente (documento 52037011, sin otras citas) tiene una cita confirmada
  // hoy con la médica de demostración unos 30 minutos después de cargar los datos, para
  // probar la llegada y la atención a cualquier hora. Si no hay un espacio libre de su
  // agenda, se crea uno adicional.
  const pacienteLlegada = pacientes[1];
  const medicoLlegada = medicos[0];
  const ocupados = new Set(espaciosOcupados);
  let inicioLlegada = new Date(Math.ceil((ahora.getTime() + minutos(30)) / minutos(5)) * minutos(5));
  let espacioLlegada = espacios.find(
    (espacio) =>
      espacio.medicoId === medicoLlegada.id &&
      espacio.inicio >= new Date(ahora.getTime() + minutos(15)) &&
      espacio.inicio < finHoy &&
      !ocupados.has(espacio.id),
  );
  if (!espacioLlegada && inicioLlegada < finHoy) {
    const consultorioId = disponibilidades.find((bloque) => bloque.medicoId === medicoLlegada.id)!.consultorioId;
    // Se corre la hora si el médico o el consultorio ya tienen un espacio que empieza ahí.
    while (
      await db.espacio.findFirst({
        where: { inicio: inicioLlegada, OR: [{ medicoId: medicoLlegada.id }, { consultorioId }] },
      })
    ) {
      inicioLlegada = new Date(inicioLlegada.getTime() + minutos(5));
    }
    espacioLlegada = await db.espacio.create({
      data: {
        medicoId: medicoLlegada.id,
        consultorioId,
        inicio: inicioLlegada,
        fin: new Date(inicioLlegada.getTime() + minutos(medicoLlegada.duracion)),
      },
    });
  }
  if (espacioLlegada && espacioLlegada.inicio < finHoy) {
    let codigo = generarCodigoCita(entero);
    while (codigos.has(codigo)) codigo = generarCodigoCita(entero);
    await db.cita.create({
      data: {
        codigo,
        pacienteId: pacienteLlegada.id,
        espacioId: espacioLlegada.id,
        espacioActivoId: espacioLlegada.id,
        especialidadId: medicoLlegada.especialidadIds[0],
        estado: "confirmada",
        canal: "telefono",
        creadaPorId: agente.id,
        fechaSolicitud: new Date(ahora.getTime() - 3 * 86_400_000),
        resultadoCobertura: "cubierta",
        detalleCobertura: "Afiliación vigente con cobertura para la especialidad.",
        intentosCobertura: 1,
        tokenRespuesta: generarTokenRespuesta(),
        recordatorioEnviadoEn: new Date(ahora.getTime() - 86_400_000),
        creadoEn: new Date(ahora.getTime() - 3 * 86_400_000),
      },
    });
    await db.espacio.update({ where: { id: espacioLlegada.id }, data: { estado: "ocupado" } });
    console.log(`  Cita de demostración para el registro de llegada: ${codigo} (documento ${pacienteLlegada.documento}).`);
  } else {
    console.log("  No se creó la cita de demostración de llegada: el día está por terminar.");
  }

  // --- Novedad de demostración (RF-11) ------------------------------------------
  // Capacitación del segundo médico el jueves y el viernes de la semana siguiente: sus
  // espacios quedan bloqueados y las citas ya asignadas aparecen como afectadas.
  console.log("Registrando una novedad de demostración…");
  const coordinador = await db.usuario.findUniqueOrThrow({ where: { correo: "coordinacion@hsr.test" } });
  const juevesSiguiente = sumarDiasIso(hoyIso, 7 - desplazamientoLunes + 3);
  const novedad = await db.novedad.create({
    data: {
      medicoId: medicos[1].id,
      tipo: "capacitacion",
      inicio: crearFechaBogota(juevesSiguiente, "00:00"),
      fin: crearFechaBogota(sumarDiasIso(juevesSiguiente, 1), "23:59"),
      motivo: "Curso de actualización en atención primaria",
      creadaPorId: coordinador.id,
    },
  });
  await db.espacio.updateMany({
    where: { medicoId: novedad.medicoId, inicio: { lt: novedad.fin }, fin: { gt: novedad.inicio } },
    data: { estado: "bloqueado", novedadId: novedad.id },
  });

  await db.bitacora.create({
    data: {
      usuarioId: administrador.id,
      entidad: "Sistema",
      accion: "carga_datos_prueba",
      estadoNuevo: JSON.stringify({ citas: citas.length, espacios: espacios.length, pacientes: pacientes.length }),
    },
  });

  const resumen = await db.cita.groupBy({ by: ["estado"], _count: { _all: true } });
  console.log(`  ${citas.length} citas creadas:`);
  for (const fila of resumen) console.log(`    ${fila.estado}: ${fila._count._all}`);
  console.log("Datos de prueba listos.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
