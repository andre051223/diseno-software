-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "correo" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TokenRecuperacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" DATETIME NOT NULL,
    "usadoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Aseguradora" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fechaNacimiento" DATETIME NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "aseguradoraId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Paciente_aseguradoraId_fkey" FOREIGN KEY ("aseguradoraId") REFERENCES "Aseguradora" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Paciente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Especialidad" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Consultorio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Medico" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "registroMedico" TEXT NOT NULL,
    "correo" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" INTEGER,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Medico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisponibilidadSemanal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medicoId" INTEGER NOT NULL,
    "consultorioId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "duracionMinutos" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisponibilidadSemanal_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisponibilidadSemanal_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Novedad" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medicoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" DATETIME NOT NULL,
    "fin" DATETIME NOT NULL,
    "motivo" TEXT,
    "creadaPorId" INTEGER,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Novedad_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Novedad_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Espacio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medicoId" INTEGER NOT NULL,
    "consultorioId" INTEGER NOT NULL,
    "disponibilidadId" INTEGER,
    "novedadId" INTEGER,
    "inicio" DATETIME NOT NULL,
    "fin" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'libre',
    "reservadoHasta" DATETIME,
    "reservadoPorId" INTEGER,
    CONSTRAINT "Espacio_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Espacio_consultorioId_fkey" FOREIGN KEY ("consultorioId") REFERENCES "Consultorio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Espacio_disponibilidadId_fkey" FOREIGN KEY ("disponibilidadId") REFERENCES "DisponibilidadSemanal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Espacio_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "Novedad" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Espacio_reservadoPorId_fkey" FOREIGN KEY ("reservadoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "espacioId" INTEGER NOT NULL,
    "espacioActivoId" INTEGER,
    "especialidadId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'agendada',
    "canal" TEXT NOT NULL,
    "creadaPorId" INTEGER NOT NULL,
    "motivoCancelacion" TEXT,
    "fechaSolicitud" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaLlegada" DATETIME,
    "inicioAtencion" DATETIME,
    "finAtencion" DATETIME,
    "resultadoCobertura" TEXT,
    "detalleCobertura" TEXT,
    "esParticular" BOOLEAN NOT NULL DEFAULT false,
    "intentosCobertura" INTEGER NOT NULL DEFAULT 0,
    "tokenRespuesta" TEXT NOT NULL,
    "recordatorioEnviadoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Cita_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cita_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "Espacio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cita_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cita_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pacienteId" INTEGER,
    "citaId" INTEGER,
    "usuarioId" INTEGER,
    "destinatario" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "asunto" TEXT,
    "contenido" TEXT NOT NULL,
    "fechaProgramada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEnvio" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    CONSTRAINT "Notificacion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notificacion_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "accion" TEXT NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_EspecialidadToMedico" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_EspecialidadToMedico_A_fkey" FOREIGN KEY ("A") REFERENCES "Especialidad" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EspecialidadToMedico_B_fkey" FOREIGN KEY ("B") REFERENCES "Medico" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "_EspecialidadToMedico_AB_unique" ON "_EspecialidadToMedico"("A", "B");

-- CreateIndex
CREATE INDEX "_EspecialidadToMedico_B_index" ON "_EspecialidadToMedico"("B");
