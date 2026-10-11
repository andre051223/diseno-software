Vas a construir desde cero un prototipo funcional del **sistema de gestión de citas médicas del Hospital Central San Rafael**, un proyecto académico de la asignatura Diseño de Software (Fundación Universitaria del Área Andina). Los requisitos funcionales ya están definidos y aprobados; tu trabajo es implementarlos con fidelidad, sin inventar funciones fuera del alcance.

## Antes de escribir código

1. Lee este prompt completo y presenta un plan por fases con la estructura de carpetas, el modelo de datos y las rutas. Espera mi aprobación antes de empezar la fase 1.
2. Usa las versiones estables actuales de cada dependencia. Consulta la documentación oficial de Next.js y Tailwind CSS si tienes dudas sobre la configuración vigente, en lugar de asumir la de versiones antiguas.
3. Al cerrar cada fase, ejecuta `npm run lint`, `npm run build` y las pruebas, corrige los errores y dame un resumen corto de lo hecho y de lo pendiente.

## Contexto del problema

El hospital atiende cerca de 600 citas diarias en 12 especialidades con unos 80 médicos. Hoy agenda por teléfono y en ventanilla, con papel y hojas de cálculo. Los problemas que el sistema debe resolver son:

- Doble reserva del mismo médico o consultorio en un mismo horario.
- Inasistencia cercana al 22 % por falta de confirmaciones y recordatorios.
- Filas en recepción y línea telefónica saturada en horas pico.
- Ninguna información consolidada sobre ocupación, cancelaciones y tiempos de espera.
- Dificultad para verificar la vigencia y cobertura del seguro al agendar.

**Fuera de alcance (no implementar):** historia clínica completa (solo un enlace simulado), facturación y cartera, hospitalización, urgencias, quirófanos, laboratorio, imágenes, farmacia y nómina.

## Stack técnico

- **Next.js** con App Router, TypeScript en modo estricto y Server Actions para las mutaciones.
- **Tailwind CSS** para todos los estilos. Sin librerías de componentes pesadas; puedes crear componentes propios en `src/components/ui`.
- **Prisma** con **SQLite** como base de datos local (archivo `prisma/dev.db`), para que el proyecto corra sin servicios externos.
- **Zod** para validar todos los formularios y entradas de Server Actions.
- Autenticación propia con contraseñas cifradas con `bcryptjs` y sesión en cookie `httpOnly` firmada con `jose`. Protección de rutas por rol en `middleware.ts`.
- **Recharts** para los gráficos de reportes.
- **Vitest** para pruebas unitarias de reglas de negocio y **Playwright** para pruebas de extremo a extremo.
- `date-fns` con zona horaria `America/Bogota` para el manejo de fechas.

## Convenciones obligatorias

- Toda la interfaz, los mensajes de error, los comentarios y la documentación van en **español** con ortografía completa: tildes, signos de apertura (¿ ¡) y mayúscula solo al inicio de la oración ("Nueva cita", no "Nueva Cita").
- Identificadores de código, nombres de archivo y rutas en ASCII, minúsculas y kebab-case para archivos y carpetas (por ejemplo `src/app/(panel)/agenda-medico/page.tsx`). Variables y funciones en camelCase sin tildes ni ñ.
- `<html lang="es">` y `<meta charset="UTF-8">`. Escribe los caracteres reales, nunca entidades HTML como `&oacute;`.
- Fechas en formato dd/mm/aaaa y horas en formato de 24 h en toda la interfaz.
- Cada Server Action o servicio que implemente un requisito lleva un comentario con su identificador, por ejemplo `// RF-13: impide la doble reserva`.

## Roles

Paciente, recepcionista, agente telefónico, médico, coordinador de agenda, director médico y administrador. Cada rol ve solo su menú. Sistemas externos simulados: aseguradora (servicio de cobertura) e historia clínica electrónica (solo enlace).

## Modelo de datos mínimo

Diseña el esquema Prisma con, al menos, estas entidades y restricciones:

- `Usuario` (correo único, hash de contraseña, rol, intentos fallidos, bloqueado hasta, activo).
- `Paciente` (tipo y número de documento con índice único compuesto, nombres, apellidos, fecha de nacimiento, teléfono, correo, aseguradora, relación opcional con `Usuario`).
- `Aseguradora`, `Especialidad`, `Consultorio` (con campo `activo` para inactivar sin borrar).
- `Medico` (relación muchos a muchos con `Especialidad`).
- `DisponibilidadSemanal` (médico, día de la semana, hora inicio, hora fin, duración de la consulta en minutos, consultorio).
- `Novedad` (médico, tipo: vacaciones, incapacidad o capacitación; fecha inicio y fin).
- `Espacio` (médico, consultorio, inicio, fin, estado: libre, reservado temporalmente, ocupado, bloqueado; `reservadoHasta`). Índices únicos sobre `(medicoId, inicio)` y `(consultorioId, inicio)`.
- `Cita` (código único legible, paciente, espacio, especialidad, estado: agendada, confirmada, pendiente de validación, en sala, atendida, cancelada, inasistencia; canal de origen: ventanilla, teléfono, portal web, aplicación móvil; creada por; motivo de cancelación; fecha de solicitud; hora de llegada; hora de inicio y fin de atención; resultado de cobertura).
- `Notificacion` (paciente, cita, canal: correo o SMS, tipo, contenido, fecha programada, fecha de envío, estado). Funciona como bandeja de salida simulada.
- `Bitacora` (usuario, entidad, acción, estado anterior, estado nuevo, fecha y hora).

La regla de no doble reserva debe garantizarse en dos capas: en la base de datos (índices únicos y transacción) y en la lógica de la Server Action. Una prueba debe demostrar que dos reservas simultáneas del mismo espacio terminan con una sola cita.

## Parámetros configurables

Centraliza estos valores en `src/lib/configuracion.ts` porque son supuestos pendientes de validar con el hospital:

| Parámetro | Valor inicial |
|---|---|
| Intentos fallidos antes de bloqueo | 3 |
| Duración del bloqueo de cuenta | 15 minutos |
| Vigencia del enlace de recuperación | 30 minutos |
| Reserva temporal de un espacio | 5 minutos |
| Anticipación mínima para cancelar | 24 horas |
| Envío del recordatorio | 48 horas antes |
| Tiempo máximo de espera a la aseguradora | 10 segundos |
| Marca de inasistencia | 20 minutos después de la hora |

## Requisitos funcionales a implementar

Cada requisito sigue el modelo [condición] + deberá/no deberá + [acción] + [a quién] + [resultado]. Implementa los 35 y no agregues funciones nuevas sin consultarme.

### Módulo 1. Autenticación y control de acceso
- **RF-01 (alta):** al ingresar correo y contraseña, validar las credenciales contra cuentas activas y abrir la sesión, para que el usuario acceda solo a las funciones de su rol.
- **RF-02 (alta):** al crear o modificar una cuenta interna, asignar uno de los siete roles, para que cada perfil vea solo sus menús y datos.
- **RF-03 (media):** tras tres intentos fallidos consecutivos, bloquear la cuenta 15 minutos y enviar un aviso al correo del titular.
- **RF-04 (media):** cuando el paciente pida recuperar su contraseña, enviarle un enlace de un solo uso con vigencia de 30 minutos (simulado en la bandeja de salida).

### Módulo 2. Registro de pacientes
- **RF-05 (alta):** en el registro por portal, aplicación o ventanilla, solicitar tipo y número de documento, nombres, apellidos, fecha de nacimiento, teléfono, correo y aseguradora.
- **RF-06 (alta):** no aceptar un tipo y número de documento ya existente.
- **RF-07 (media):** al actualizar datos de contacto, guardar el cambio con usuario, fecha y hora.

### Módulo 3. Médicos, especialidades, horarios y consultorios
- **RF-08 (alta):** permitir al coordinador crear, editar e inactivar especialidades y consultorios.
- **RF-09 (alta):** permitir al coordinador registrar médicos y asociarlos a una o más especialidades.
- **RF-10 (alta):** al configurar la disponibilidad semanal, generar los espacios según días, horario, duración y consultorio, sin solaparlos con otros espacios del mismo consultorio. Generar espacios para las próximas 8 semanas.
- **RF-11 (alta):** al registrar una novedad del médico, bloquear los espacios afectados y listar al coordinador las citas ya asignadas en ese periodo.

### Módulo 4. Agendamiento, reprogramación y cancelación
- **RF-12 (alta):** mostrar los espacios libres filtrados por especialidad, médico y rango de fechas.
- **RF-13 (alta):** no asignar un espacio con cita activa para el mismo médico o consultorio.
- **RF-14 (alta):** mientras un usuario completa la reserva, bloquear el espacio a los demás durante cinco minutos; liberar automáticamente al vencer.
- **RF-15 (alta):** al confirmar, generar un código único y un comprobante imprimible con fecha, hora, médico, especialidad y consultorio.
- **RF-16 (alta):** al reprogramar, liberar el espacio original y asignar el nuevo en una sola transacción.
- **RF-17 (alta):** al cancelar con al menos 24 horas de anticipación, liberar el espacio y pedir el motivo. Con menos tiempo, mostrar el aviso de que debe comunicarse con recepción.
- **RF-18 (media):** no aceptar una segunda cita activa del mismo paciente en la misma especialidad.
- **RF-19 (media):** registrar el canal de origen y el usuario que creó la cita.
- **RF-20 (media):** guardar en la bitácora cada creación, reprogramación o cancelación con usuario, fecha, hora y estados anterior y nuevo.

### Módulo 5. Validación de cobertura
- **RF-21 (alta):** antes de confirmar, consultar a la aseguradora la vigencia y la cobertura para la especialidad. Implementa la aseguradora como una ruta interna `src/app/api/aseguradora/cobertura/route.ts` con respuestas simuladas y deterministas según el documento (por ejemplo, documentos que terminan en 0 no tienen afiliación vigente, los que terminan en 9 tardan más de 10 segundos).
- **RF-22 (media):** si no hay vigencia o cobertura, mostrar el motivo y la opción de agendar como particular, y registrar la decisión.
- **RF-23 (media):** si la aseguradora no responde en 10 segundos, dejar la cita en "pendiente de validación", informar al usuario y reintentar en segundo plano.

### Módulo 6. Notificaciones y recordatorios
- **RF-24 (alta):** al confirmar, reprogramar o cancelar, registrar en la bandeja de salida un correo y un SMS con los datos actualizados.
- **RF-25 (alta):** 48 horas antes de la cita, enviar un recordatorio con enlaces para confirmar o cancelar.
- **RF-26 (alta):** cuando el paciente responda, cambiar el estado a "confirmada" o "cancelada", liberar el espacio si cancela y reflejarlo en recepción y en la agenda del médico.
- **RF-27 (media):** cuando una novedad del médico cancele citas, avisar a cada paciente con el motivo y un enlace para reprogramar.

Los procesos programados (recordatorios, liberación de reservas vencidas, reintentos de cobertura y marca de inasistencia) se ejecutan desde una ruta `src/app/api/tareas/route.ts` protegida con un token, más un botón "Ejecutar tareas programadas" en el panel del administrador para la demostración. Crea una página `/bandeja-salida` para que el administrador vea los mensajes simulados.

### Módulo 7. Registro de llegada y atención
- **RF-28 (alta):** permitir a la recepcionista registrar la llegada buscando por documento o código.
- **RF-29 (alta):** mostrar a cada médico su lista del día con hora, paciente y estado, actualizada sin recargar (revalidación cada 30 segundos es suficiente).
- **RF-30 (alta):** permitir al médico registrar inicio y fin de la atención y marcar la cita como atendida, con un enlace simulado a la historia clínica.
- **RF-31 (media):** 20 minutos después de la hora sin registro de llegada, marcar la cita como inasistencia.

### Módulo 8. Reportes de gestión
- **RF-32 (alta):** mostrar al director médico el porcentaje de ocupación por especialidad, médico y consultorio en un rango de fechas.
- **RF-33 (alta):** presentar número y porcentaje de inasistencias y cancelaciones por especialidad y canal.
- **RF-34 (media):** calcular días promedio entre solicitud y cita, y minutos promedio entre llegada e inicio de atención.
- **RF-35 (baja):** exportar cada reporte a CSV y a PDF con los filtros aplicados.

## Pantallas por rol

- **Público:** inicio con explicación breve del servicio, inicio de sesión, registro de paciente, recuperación de contraseña.
- **Paciente:** mis citas, nueva cita (asistente en pasos: especialidad, médico y fecha, horario, validación de cobertura, confirmación), reprogramar, cancelar, mis datos.
- **Recepcionista:** registro de llegada del día, agendar en nombre de un paciente, búsqueda de pacientes.
- **Agente telefónico:** búsqueda de pacientes y el mismo asistente de agendamiento con canal "teléfono".
- **Médico:** agenda del día y detalle de la atención.
- **Coordinador de agenda:** especialidades, consultorios, médicos, disponibilidad semanal, novedades.
- **Director médico:** tablero de reportes con filtros y gráficos.
- **Administrador:** usuarios y roles, bitácora, bandeja de salida, tareas programadas.

## Dirección visual

Interfaz de un hospital: sobria, clara y legible para personas de todas las edades. Paleta basada en azul petróleo y blanco con un color de acento para acciones principales, contraste AA como mínimo, tipografía sans serif con tamaño base de 16 px, estados de cita con color y texto (nunca solo color). Diseño adaptable desde 360 px de ancho, porque los pacientes agendarán desde el teléfono. Estados vacíos, de carga y de error en todas las vistas.

## Datos de prueba

Crea `prisma/seed.ts` con: las 12 especialidades (medicina general, pediatría, ginecología, medicina interna, cardiología, dermatología, ortopedia, oftalmología, otorrinolaringología, psiquiatría, neurología, endocrinología), 10 consultorios, 24 médicos con disponibilidad semanal, 3 aseguradoras, 60 pacientes con citas pasadas y futuras en todos los estados (para que los reportes tengan datos) y un usuario por rol. Documenta las credenciales de prueba en el `README.md`.

## Pruebas mínimas

- Vitest: RF-06, RF-13, RF-14, RF-17, RF-18 y RF-31, más la generación de espacios sin solapamiento de RF-10.
- Playwright: flujo completo del paciente (registro, agendamiento con cobertura, confirmación por recordatorio), intento de doble reserva desde dos sesiones y registro de llegada seguido de atención.

## Fases sugeridas

1. Proyecto base, Tailwind, Prisma, esquema, semilla y autenticación con roles (RF-01 a RF-04).
2. Pacientes y administración de agenda (RF-05 a RF-11).
3. Agendamiento con cobertura y bitácora (RF-12 a RF-23).
4. Notificaciones y tareas programadas (RF-24 a RF-27).
5. Registro de llegada y atención (RF-28 a RF-31).
6. Reportes y exportación (RF-32 a RF-35).
7. Pruebas, revisión de accesibilidad, `README.md` con instrucciones de instalación y una tabla que relacione cada RF con el archivo donde se implementa.

## Criterio de terminado

El proyecto arranca con `npm install`, `npx prisma migrate dev`, `npx prisma db seed` y `npm run dev`; los 35 requisitos tienen implementación trazable; las pruebas pasan; `npm run build` termina sin errores y no queda texto de interfaz en inglés.