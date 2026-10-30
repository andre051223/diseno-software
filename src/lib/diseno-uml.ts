/**
 * Datos de la página «Diseño UML»: casos de uso del eje 2 y diagramas
 * estructurales y de comportamiento del eje 3. Cada caso de uso CU-nn
 * representa al requisito RF-nn. Las fuentes PlantUML están en `docs/uml/` y
 * los SVG en `public/diagramas/`.
 */

export type Relacion = "asociacion" | "include" | "extend";

export const etiquetasRelacion: Record<Relacion, string> = {
  asociacion: "Asociación",
  include: "«include»",
  extend: "«extend»",
};

export type Diagrama = {
  id: string;
  titulo: string;
  /** Ruta pública del SVG. */
  archivo: string;
  /** Dimensiones del `viewBox` del SVG. */
  ancho: number;
  alto: number;
  alt: string;
  descripcion: string;
  /** Requisitos que cubre el diagrama. */
  requisitos: string[];
  /** Eje de la asignatura en el que se entregó el diagrama. */
  eje: 2 | 3;
  categoria: CategoriaDiagrama;
};

export type CategoriaDiagrama = "casos-uso" | "estructural" | "comportamiento";

/** Identificador RF-nn con dos dígitos. */
export function idRequisito(numero: number): string {
  return `RF-${String(numero).padStart(2, "0")}`;
}

function rangoRequisitos(desde: number, hasta: number): string[] {
  return Array.from({ length: hasta - desde + 1 }, (_, indice) => idRequisito(desde + indice));
}

export const diagramas: Diagrama[] = [
  {
    id: "diagrama-roles",
    titulo: "Jerarquía de actores (roles)",
    archivo: "/diagramas/01-diagrama-roles.svg",
    ancho: 2027,
    alto: 1327,
    alt: "Diagrama de actores: el usuario del sistema se especializa en paciente y personal del hospital; el personal se divide en personal de agendamiento (recepcionista y agente telefónico), médico, coordinador de agenda, director médico y administrador. Aparte están la aseguradora, la historia clínica electrónica y el temporizador del sistema.",
    descripcion:
      "Muestra la generalización entre los siete roles del sistema y los actores no humanos. Los actores abstractos agrupan comportamientos comunes, como el inicio de sesión de todo usuario o el agendamiento que comparten recepcionista y agente telefónico.",
    requisitos: ["RF-01", "RF-02"],
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "casos-uso-sistema",
    titulo: "Casos de uso del sistema",
    archivo: "/diagramas/02-casos-uso-sistema.svg",
    ancho: 2160,
    alto: 2168,
    alt: "Diagrama general con catorce casos de uso de alto nivel del sistema de gestión de citas, conectados con el paciente, el personal de agendamiento, la recepcionista, el médico, el coordinador de agenda, el director médico, el administrador, la aseguradora, la historia clínica electrónica y el temporizador del sistema.",
    descripcion:
      "Vista de conjunto con los catorce casos de uso de alto nivel y los actores que los usan. Agendar, reprogramar y cancelar incluyen la notificación al paciente, y agendar incluye además la validación de cobertura con la aseguradora.",
    requisitos: rangoRequisitos(1, 35),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-1-autenticacion",
    titulo: "Módulo 1. Autenticación y control de acceso",
    archivo: "/diagramas/03-cu-modulo-1-autenticacion.svg",
    ancho: 1762,
    alto: 862,
    alt: "Casos de uso de autenticación: el usuario del sistema inicia sesión (CU-01), el paciente recupera su contraseña (CU-04) y el administrador asigna el rol a una cuenta interna (CU-02). CU-03, bloquear cuenta y avisar al titular, extiende a CU-01 tras tres intentos fallidos seguidos.",
    descripcion:
      "Modela el acceso al sistema. El bloqueo de la cuenta es una extensión del inicio de sesión que ocurre solo después de tres intentos fallidos consecutivos.",
    requisitos: rangoRequisitos(1, 4),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-2-pacientes",
    titulo: "Módulo 2. Registro de pacientes",
    archivo: "/diagramas/04-cu-modulo-2-pacientes.svg",
    ancho: 1912,
    alto: 497,
    alt: "Casos de uso de registro de pacientes: el paciente y la recepcionista registran al paciente (CU-05) y actualizan sus datos de contacto (CU-07). CU-05 incluye la verificación de documento único (CU-06).",
    descripcion:
      "El paciente se registra por el portal o la recepcionista lo hace en ventanilla. Todo registro incluye la verificación de que el tipo y número de documento no exista.",
    requisitos: rangoRequisitos(5, 7),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-3-agenda",
    titulo: "Módulo 3. Médicos, especialidades, horarios y consultorios",
    archivo: "/diagramas/05-cu-modulo-3-agenda.svg",
    ancho: 1429,
    alto: 756,
    alt: "Casos de uso de gestión de la agenda: el coordinador de agenda gestiona especialidades y consultorios (CU-08), registra médicos (CU-09), configura la disponibilidad semanal (CU-10) y registra novedades del médico (CU-11).",
    descripcion:
      "El coordinador de agenda define la oferta de atención. La disponibilidad semanal genera los espacios sin solaparlos y las novedades bloquean los espacios afectados.",
    requisitos: rangoRequisitos(8, 11),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-4-agendamiento",
    titulo: "Módulo 4. Agendamiento, reprogramación y cancelación",
    archivo: "/diagramas/06-cu-modulo-4-agendamiento.svg",
    ancho: 1789,
    alto: 1077,
    alt: "Casos de uso de agendamiento: el paciente y el personal de agendamiento consultan disponibilidad (CU-12), confirman (CU-15), reprograman (CU-16) y cancelan citas (CU-17). CU-15 incluye CU-13, CU-14, CU-18 y CU-20; CU-16 incluye CU-13 y CU-20; CU-17 incluye CU-20; CU-19 extiende a CU-15.",
    descripcion:
      "Es el núcleo del sistema. Confirmar una cita incluye impedir la doble reserva, bloquear el espacio cinco minutos, verificar una sola cita activa por especialidad y registrar en la bitácora; el canal de origen se registra cuando agenda el personal del hospital.",
    requisitos: rangoRequisitos(12, 20),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-5-cobertura",
    titulo: "Módulo 5. Validación de cobertura",
    archivo: "/diagramas/07-cu-modulo-5-cobertura.svg",
    ancho: 2581,
    alto: 675,
    alt: "Casos de uso de validación de cobertura: confirmar la cita (CU-15) incluye validar vigencia y cobertura (CU-21) con la aseguradora. CU-22, ofrecer atención como particular, y CU-23, dejar la cita pendiente de validación y reintentar, extienden a CU-21; el temporizador del sistema ejecuta los reintentos.",
    descripcion:
      "Antes de confirmar se consulta a la aseguradora. Si la afiliación no está vigente se ofrece la atención particular, y si la aseguradora no responde en 10 segundos la cita queda pendiente y el temporizador reintenta.",
    requisitos: rangoRequisitos(21, 23),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-6-notificaciones",
    titulo: "Módulo 6. Notificaciones y recordatorios",
    archivo: "/diagramas/08-cu-modulo-6-notificaciones.svg",
    ancho: 1889,
    alto: 772,
    alt: "Casos de uso de notificaciones: confirmar, reprogramar o cancelar una cita incluye notificar el cambio (CU-24). El temporizador envía el recordatorio 48 horas antes (CU-25), el paciente lo responde (CU-26) y CU-27, avisar cancelación por novedad, extiende al registro de novedad del médico (CU-11).",
    descripcion:
      "Reúne los mensajes que recibe el paciente. Los cambios de la cita y las cancelaciones por novedad generan avisos, y el temporizador envía el recordatorio que el paciente puede responder.",
    requisitos: rangoRequisitos(24, 27),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-7-atencion",
    titulo: "Módulo 7. Registro de llegada y atención",
    archivo: "/diagramas/09-cu-modulo-7-atencion.svg",
    ancho: 1208,
    alto: 754,
    alt: "Casos de uso de llegada y atención: la recepcionista registra la llegada del paciente (CU-28), el médico consulta su agenda del día (CU-29) y registra el inicio y fin de la atención (CU-30) con enlace a la historia clínica electrónica, y el temporizador marca la inasistencia (CU-31).",
    descripcion:
      "Cubre el día de la cita, desde la llegada a recepción hasta el fin de la atención. Si el paciente no llega, el temporizador marca la inasistencia.",
    requisitos: rangoRequisitos(28, 31),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "cu-modulo-8-reportes",
    titulo: "Módulo 8. Reportes de gestión",
    archivo: "/diagramas/10-cu-modulo-8-reportes.svg",
    ancho: 1472,
    alto: 572,
    alt: "Casos de uso de reportes: el director médico consulta la ocupación de la agenda (CU-32), las inasistencias y cancelaciones (CU-33) y los tiempos de espera (CU-34). CU-35, exportar reporte, extiende a los tres.",
    descripcion:
      "El director médico consulta los tres indicadores de gestión. La exportación es opcional y extiende a cualquiera de los tres reportes.",
    requisitos: rangoRequisitos(32, 35),
    eje: 2,
    categoria: "casos-uso",
  },
  {
    id: "diagrama-clases",
    titulo: "Diagrama de clases del dominio",
    archivo: "/diagramas/11-diagrama-clases.svg",
    ancho: 3147,
    alto: 3656,
    alt: "Diagrama de clases con las 13 clases del dominio: Usuario, TokenRecuperacion, Paciente, Aseguradora, Especialidad, Consultorio, Medico, DisponibilidadSemanal, Novedad, Espacio, Cita, Notificacion y Bitacora, con sus atributos, operaciones, asociaciones con multiplicidades y un paquete con los nueve enumerados.",
    descripcion:
      "Presenta las 13 clases del dominio tomadas de prisma/schema.prisma, con sus atributos, multiplicidades y los nueve enumerados. Las operaciones se ubican en la clase cuyo estado cambian y se implementan en src/servicios/.",
    requisitos: rangoRequisitos(1, 35),
    eje: 3,
    categoria: "estructural",
  },
  {
    id: "diagrama-objetos",
    titulo: "Diagrama de objetos después de confirmar la cita HSR-7K3QX2",
    archivo: "/diagramas/12-diagrama-objetos.svg",
    ancho: 3010,
    alto: 1379,
    alt: "Diagrama de objetos con la cuenta y los datos del paciente, su aseguradora, la especialidad de medicina general, la Dra. Gómez, el consultorio 101, el bloque de disponibilidad del martes, el espacio de las 8:00 ocupado, la cita HSR-7K3QX2 agendada, las notificaciones por correo y SMS, y el registro de creación en la bitácora.",
    descripcion:
      "Muestra el estado de la base después de confirmar por el portal una cita de medicina general con la Dra. Laura Marcela Gómez Restrepo: el espacio queda ocupado, la cita agendada, se generan dos notificaciones y un registro de bitácora. Los valores son ilustrativos.",
    requisitos: ["RF-13", "RF-15", "RF-19", "RF-20", "RF-24"],
    eje: 3,
    categoria: "estructural",
  },
  {
    id: "diagrama-componentes",
    titulo: "Diagrama de componentes",
    archivo: "/diagramas/13-diagrama-componentes.svg",
    ancho: 2916,
    alto: 2181,
    alt: "Diagrama de componentes: el navegador pasa por la protección de rutas (proxy.ts) hacia las pantallas públicas y el panel por rol, que llaman a las Server Actions. Estas usan diez componentes de dominio (autenticación, pacientes, agenda, agendamiento, cobertura, atención, reportes, notificaciones, bitácora y tareas programadas), que acceden a PostgreSQL en Neon mediante Prisma Client. La cobertura consulta la API de la aseguradora simulada y el programador externo invoca la API de tareas.",
    descripcion:
      "Organiza la aplicación en capas conectadas por interfaces: proxy.ts, las pantallas, las Server Actions, diez componentes de dominio y Prisma Client. La aseguradora simulada se expone mediante la interfaz ICobertura y la ruta de tareas mediante ITareas.",
    requisitos: rangoRequisitos(1, 35),
    eje: 3,
    categoria: "estructural",
  },
  {
    id: "diagrama-paquetes",
    titulo: "Diagrama de paquetes",
    archivo: "/diagramas/14-diagrama-paquetes.svg",
    ancho: 3333,
    alto: 2187,
    alt: "Diagrama de paquetes en cinco capas: presentación (app/(publico), app/(panel), app/api y components), aplicación (acciones y proxy.ts), dominio (servicios), soporte (lib) y persistencia (generated/prisma y prisma), con dependencias hacia abajo y las bibliotecas externas Next.js, React, Prisma, Zod, jose, bcryptjs, date-fns, Recharts y pdf-lib.",
    descripcion:
      "Agrupa las carpetas del repositorio en cinco capas cuyas dependencias de importación van siempre hacia abajo. También indica qué bibliotecas externas usa cada capa.",
    requisitos: rangoRequisitos(1, 35),
    eje: 3,
    categoria: "estructural",
  },
  {
    id: "diagrama-despliegue",
    titulo: "Diagrama de despliegue en Vercel y Neon",
    archivo: "/diagramas/15-diagrama-despliegue.svg",
    ancho: 3352,
    alto: 1902,
    alt: "Diagrama de despliegue: los navegadores del dispositivo del paciente y de los equipos del hospital se conectan por HTTPS a Vercel, que sirve los archivos estáticos desde la CDN y ejecuta la aplicación en Vercel Functions. Las funciones se conectan por TLS al servidor PostgreSQL de Neon mediante el pooler, y un programador externo llama a /api/tareas con el token de tareas.",
    descripcion:
      "Ubica los navegadores del paciente y del hospital, la plataforma Vercel (CDN y Vercel Functions) y la base PostgreSQL en Neon, conectada por TLS a través del pooler. El programador externo llama a /api/tareas con TAREAS_TOKEN para ejecutar los reintentos, los recordatorios y las inasistencias.",
    requisitos: ["RF-21", "RF-23", "RF-25", "RF-31"],
    eje: 3,
    categoria: "estructural",
  },
  {
    id: "secuencia-iniciar-sesion",
    titulo: "Secuencia del inicio de sesión",
    archivo: "/diagramas/16-secuencia-iniciar-sesion.svg",
    ancho: 3235,
    alto: 2170,
    alt: "Diagrama de secuencia del inicio de sesión: el usuario envía el formulario, la acción valida los datos con Zod y el servicio de autenticación verifica las credenciales contra la entidad Usuario. Los fragmentos alternativos cubren los cuatro resultados posibles; al tercer intento fallido la cuenta se bloquea, se crea una notificación para el titular y se registra en la bitácora. Si las credenciales son correctas se crea la sesión.",
    descripcion:
      "Detalla CU-01 con su extensión CU-03. Los datos se validan con Zod y el inicio de sesión tiene cuatro resultados posibles; tras tres intentos fallidos la cuenta se bloquea, se avisa al titular y se registra en la bitácora.",
    requisitos: ["RF-01", "RF-03"],
    eje: 3,
    categoria: "comportamiento",
  },
  {
    id: "secuencia-agendar-cita",
    titulo: "Secuencia de la confirmación de una cita",
    archivo: "/diagramas/17-secuencia-agendar-cita.svg",
    ancho: 3443,
    alto: 3581,
    alt: "Diagrama de secuencia de la confirmación de una cita: el paciente o el personal de agendamiento elige un horario y el servicio de agendamiento reserva el espacio por cinco minutos; luego el servicio de cobertura consulta la API de la aseguradora con un límite de 10 segundos, y por último la cita se confirma en una transacción que impide la doble reserva, verifica una sola cita activa por especialidad, registra en la bitácora y genera las notificaciones.",
    descripcion:
      "Detalla CU-15 con sus inclusiones en tres pasos: la reserva temporal del espacio por cinco minutos, la validación de cobertura con un límite de 10 segundos y la confirmación en una transacción. En la transacción actúa la doble barrera contra la doble reserva.",
    requisitos: ["RF-13", "RF-14", "RF-15", "RF-18", "RF-20", "RF-21", "RF-23", "RF-24"],
    eje: 3,
    categoria: "comportamiento",
  },
  {
    id: "secuencia-recordatorio",
    titulo: "Secuencia del envío y la respuesta del recordatorio",
    archivo: "/diagramas/18-secuencia-recordatorio.svg",
    ancho: 4268,
    alto: 3202,
    alt: "Diagrama de secuencia del recordatorio: el temporizador externo llama a /api/tareas con su token, el servicio de recordatorios busca las citas que ocurren en 48 horas y crea una notificación por cita sin duplicados. Después, el paciente abre el enlace del recordatorio en responder-cita sin iniciar sesión y confirma o cancela la cita.",
    descripcion:
      "Detalla CU-25 y CU-26. Las tareas programadas están protegidas con un token y envían el recordatorio 48 horas antes de la cita sin duplicados; el paciente responde mediante el enlace recibido, sin iniciar sesión.",
    requisitos: ["RF-25", "RF-26"],
    eje: 3,
    categoria: "comportamiento",
  },
];

export type FilaTrazabilidad = {
  rf: string;
  cu: string;
  casoUso: string;
  actor: string;
  relacion: Relacion;
  /** Casos de uso con los que se relaciona («include» o «extend»). */
  detalle?: string;
};

export const trazabilidad: FilaTrazabilidad[] = [
  { rf: "RF-01", cu: "CU-01", casoUso: "Iniciar sesión", actor: "Usuario del sistema", relacion: "asociacion" },
  { rf: "RF-02", cu: "CU-02", casoUso: "Asignar rol a una cuenta interna", actor: "Administrador", relacion: "asociacion" },
  { rf: "RF-03", cu: "CU-03", casoUso: "Bloquear cuenta y avisar al titular", actor: "Lo ejecuta el sistema", relacion: "extend", detalle: "de CU-01" },
  { rf: "RF-04", cu: "CU-04", casoUso: "Recuperar contraseña", actor: "Paciente", relacion: "asociacion" },
  { rf: "RF-05", cu: "CU-05", casoUso: "Registrar paciente", actor: "Paciente, recepcionista", relacion: "asociacion" },
  { rf: "RF-06", cu: "CU-06", casoUso: "Verificar documento único", actor: "Lo ejecuta el sistema", relacion: "include", detalle: "desde CU-05" },
  { rf: "RF-07", cu: "CU-07", casoUso: "Actualizar datos de contacto", actor: "Paciente, recepcionista", relacion: "asociacion" },
  { rf: "RF-08", cu: "CU-08", casoUso: "Gestionar especialidades y consultorios", actor: "Coordinador de agenda", relacion: "asociacion" },
  { rf: "RF-09", cu: "CU-09", casoUso: "Registrar médico y asociar especialidades", actor: "Coordinador de agenda", relacion: "asociacion" },
  { rf: "RF-10", cu: "CU-10", casoUso: "Configurar disponibilidad semanal", actor: "Coordinador de agenda", relacion: "asociacion" },
  { rf: "RF-11", cu: "CU-11", casoUso: "Registrar novedad del médico", actor: "Coordinador de agenda", relacion: "asociacion" },
  { rf: "RF-12", cu: "CU-12", casoUso: "Consultar disponibilidad", actor: "Paciente, personal de agendamiento", relacion: "asociacion" },
  { rf: "RF-13", cu: "CU-13", casoUso: "Impedir la doble reserva", actor: "Lo ejecuta el sistema", relacion: "include", detalle: "desde CU-15 y CU-16" },
  { rf: "RF-14", cu: "CU-14", casoUso: "Bloquear espacio durante cinco minutos", actor: "Lo ejecuta el sistema", relacion: "include", detalle: "desde CU-15" },
  { rf: "RF-15", cu: "CU-15", casoUso: "Confirmar cita y generar comprobante", actor: "Paciente, personal de agendamiento", relacion: "asociacion" },
  { rf: "RF-16", cu: "CU-16", casoUso: "Reprogramar cita", actor: "Paciente, personal de agendamiento", relacion: "asociacion" },
  { rf: "RF-17", cu: "CU-17", casoUso: "Cancelar cita", actor: "Paciente, personal de agendamiento", relacion: "asociacion" },
  { rf: "RF-18", cu: "CU-18", casoUso: "Verificar una cita activa por especialidad", actor: "Lo ejecuta el sistema", relacion: "include", detalle: "desde CU-15" },
  { rf: "RF-19", cu: "CU-19", casoUso: "Registrar canal de origen", actor: "Lo ejecuta el sistema", relacion: "extend", detalle: "de CU-15" },
  { rf: "RF-20", cu: "CU-20", casoUso: "Registrar en bitácora de auditoría", actor: "Lo ejecuta el sistema", relacion: "include", detalle: "desde CU-15, CU-16 y CU-17" },
  { rf: "RF-21", cu: "CU-21", casoUso: "Validar vigencia y cobertura", actor: "Lo ejecuta el sistema; responde la aseguradora", relacion: "include", detalle: "desde CU-15" },
  { rf: "RF-22", cu: "CU-22", casoUso: "Ofrecer atención como particular", actor: "Lo ejecuta el sistema", relacion: "extend", detalle: "de CU-21" },
  { rf: "RF-23", cu: "CU-23", casoUso: "Dejar cita pendiente de validación y reintentar", actor: "Temporizador del sistema", relacion: "extend", detalle: "de CU-21" },
  { rf: "RF-24", cu: "CU-24", casoUso: "Notificar cambio de la cita", actor: "Lo ejecuta el sistema", relacion: "include", detalle: "desde CU-15, CU-16 y CU-17" },
  { rf: "RF-25", cu: "CU-25", casoUso: "Enviar recordatorio 48 horas antes", actor: "Temporizador del sistema", relacion: "asociacion" },
  { rf: "RF-26", cu: "CU-26", casoUso: "Responder recordatorio", actor: "Paciente", relacion: "asociacion" },
  { rf: "RF-27", cu: "CU-27", casoUso: "Avisar cancelación por novedad", actor: "Lo ejecuta el sistema", relacion: "extend", detalle: "de CU-11" },
  { rf: "RF-28", cu: "CU-28", casoUso: "Registrar llegada del paciente", actor: "Recepcionista", relacion: "asociacion" },
  { rf: "RF-29", cu: "CU-29", casoUso: "Consultar agenda del día", actor: "Médico", relacion: "asociacion" },
  { rf: "RF-30", cu: "CU-30", casoUso: "Registrar inicio y fin de la atención", actor: "Médico", relacion: "asociacion" },
  { rf: "RF-31", cu: "CU-31", casoUso: "Marcar inasistencia", actor: "Temporizador del sistema", relacion: "asociacion" },
  { rf: "RF-32", cu: "CU-32", casoUso: "Consultar ocupación de la agenda", actor: "Director médico", relacion: "asociacion" },
  { rf: "RF-33", cu: "CU-33", casoUso: "Consultar inasistencias y cancelaciones", actor: "Director médico", relacion: "asociacion" },
  { rf: "RF-34", cu: "CU-34", casoUso: "Consultar tiempos de espera", actor: "Director médico", relacion: "asociacion" },
  { rf: "RF-35", cu: "CU-35", casoUso: "Exportar reporte", actor: "Director médico", relacion: "extend", detalle: "de CU-32, CU-33 y CU-34" },
];
