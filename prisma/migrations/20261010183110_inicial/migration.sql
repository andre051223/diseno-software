-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('paciente', 'recepcionista', 'agente_telefonico', 'medico', 'coordinador_agenda', 'director_medico', 'administrador');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'TI', 'CE', 'RC', 'PA');

-- CreateEnum
CREATE TYPE "EstadoEspacio" AS ENUM ('libre', 'reservado_temporal', 'ocupado', 'bloqueado');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('agendada', 'confirmada', 'pendiente_validacion', 'en_sala', 'atendida', 'cancelada', 'inasistencia');

-- CreateEnum
CREATE TYPE "CanalOrigen" AS ENUM ('ventanilla', 'telefono', 'portal_web', 'aplicacion_movil');

-- CreateEnum
CREATE TYPE "TipoNovedad" AS ENUM ('vacaciones', 'incapacidad', 'capacitacion');

-- CreateEnum
CREATE TYPE "ResultadoCobertura" AS ENUM ('cubierta', 'sin_vigencia', 'sin_cobertura', 'sin_respuesta');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('correo', 'sms');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('pendiente', 'enviada');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "correo" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRecuperacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aseguradora" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Aseguradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" SERIAL NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "aseguradoraId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Especialidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultorio" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Consultorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medico" (
    "id" SERIAL NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "registroMedico" TEXT NOT NULL,
    "correo" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisponibilidadSemanal" (
    "id" SERIAL NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "consultorioId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "duracionMinutos" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisponibilidadSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Novedad" (
    "id" SERIAL NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "tipo" "TipoNovedad" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "creadaPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Espacio" (
    "id" SERIAL NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "consultorioId" INTEGER NOT NULL,
    "disponibilidadId" INTEGER,
    "novedadId" INTEGER,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoEspacio" NOT NULL DEFAULT 'libre',
    "reservadoHasta" TIMESTAMP(3),
    "reservadoPorId" INTEGER,

    CONSTRAINT "Espacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "espacioId" INTEGER NOT NULL,
    "espacioActivoId" INTEGER,
    "especialidadId" INTEGER NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'agendada',
    "canal" "CanalOrigen" NOT NULL,
    "creadaPorId" INTEGER NOT NULL,
    "motivoCancelacion" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaLlegada" TIMESTAMP(3),
    "inicioAtencion" TIMESTAMP(3),
    "finAtencion" TIMESTAMP(3),
    "resultadoCobertura" "ResultadoCobertura",
    "detalleCobertura" TEXT,
    "esParticular" BOOLEAN NOT NULL DEFAULT false,
    "intentosCobertura" INTEGER NOT NULL DEFAULT 0,
    "tokenRespuesta" TEXT NOT NULL,
    "recordatorioEnviadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER,
    "citaId" INTEGER,
    "usuarioId" INTEGER,
    "destinatario" TEXT NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "tipo" TEXT NOT NULL,
    "asunto" TEXT,
    "contenido" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEnvio" TIMESTAMP(3),
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'pendiente',

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "accion" TEXT NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EspecialidadToMedico" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_EspecialidadToMedico_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacion_tokenHash_key" ON "TokenRecuperacion"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRecuperacion_usuarioId_idx" ON "TokenRecuperacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Aseguradora_codigo_key" ON "Aseguradora"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Aseguradora_nombre_key" ON "Aseguradora"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_usuarioId_key" ON "Paciente"("usuarioId");

-- CreateIndex
CREATE INDEX "Paciente_apellidos_nombres_idx" ON "Paciente"("apellidos", "nombres");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_tipoDocumento_numeroDocumento_key" ON "Paciente"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_nombre_key" ON "Especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Consultorio_nombre_key" ON "Consultorio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Medico_registroMedico_key" ON "Medico"("registroMedico");

-- CreateIndex
CREATE UNIQUE INDEX "Medico_usuarioId_key" ON "Medico"("usuarioId");

-- CreateIndex
CREATE INDEX "DisponibilidadSemanal_medicoId_idx" ON "DisponibilidadSemanal"("medicoId");

-- CreateIndex
CREATE INDEX "DisponibilidadSemanal_consultorioId_diaSemana_idx" ON "DisponibilidadSemanal"("consultorioId", "diaSemana");

-- CreateIndex
CREATE INDEX "Novedad_medicoId_inicio_idx" ON "Novedad"("medicoId", "inicio");

-- CreateIndex
CREATE INDEX "Espacio_estado_inicio_idx" ON "Espacio"("estado", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Espacio_medicoId_inicio_key" ON "Espacio"("medicoId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Espacio_consultorioId_inicio_key" ON "Espacio"("consultorioId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_codigo_key" ON "Cita"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_espacioActivoId_key" ON "Cita"("espacioActivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_tokenRespuesta_key" ON "Cita"("tokenRespuesta");

-- CreateIndex
CREATE INDEX "Cita_pacienteId_especialidadId_estado_idx" ON "Cita"("pacienteId", "especialidadId", "estado");

-- CreateIndex
CREATE INDEX "Cita_estado_idx" ON "Cita"("estado");

-- CreateIndex
CREATE INDEX "Cita_espacioId_idx" ON "Cita"("espacioId");

-- CreateIndex
CREATE INDEX "Notificacion_estado_fechaProgramada_idx" ON "Notificacion"("estado", "fechaProgramada");

-- CreateIndex
CREATE INDEX "Notificacion_citaId_idx" ON "Notificacion"("citaId");

-- CreateIndex
CREATE INDEX "Bitacora_entidad_entidadId_idx" ON "Bitacora"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Bitacora_fecha_idx" ON "Bitacora"("fecha");

-- CreateIndex
CREATE INDEX "_EspecialidadToMedico_B_index" ON "_EspecialidadToMedico"("B");

-- AddForeignKey
ALTER TABLE "TokenRecuperacion" ADD CONSTRAINT "TokenRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_aseguradoraId_fkey" FOREIGN KEY ("aseguradoraId") REFERENCES "Aseguradora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medico" ADD CONSTRAINT "Medico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadSemanal" ADD CONSTRAINT "DisponibilidadSemanal_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadSemanal" ADD CONSTRAINT "DisponibilidadSemanal_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Espacio" ADD CONSTRAINT "Espacio_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Espacio" ADD CONSTRAINT "Espacio_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Espacio" ADD CONSTRAINT "Espacio_disponibilidadId_fkey" FOREIGN KEY ("disponibilidadId") REFERENCES "DisponibilidadSemanal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Espacio" ADD CONSTRAINT "Espacio_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "Novedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Espacio" ADD CONSTRAINT "Espacio_reservadoPorId_fkey" FOREIGN KEY ("reservadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "Espacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EspecialidadToMedico" ADD CONSTRAINT "_EspecialidadToMedico_A_fkey" FOREIGN KEY ("A") REFERENCES "Especialidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EspecialidadToMedico" ADD CONSTRAINT "_EspecialidadToMedico_B_fkey" FOREIGN KEY ("B") REFERENCES "Medico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
