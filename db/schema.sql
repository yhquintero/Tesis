-- =====================================================================
-- Sistema de Gestión de Contratos Determinados y Pagos por Sobrecarga
-- Departamento de Informática - Universidad de Pinar del Río
-- Esquema SQLite (v1) - núcleo local-first
-- =====================================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Usuarios y seguridad
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  nombre            TEXT    NOT NULL,
  password_hash     TEXT    NOT NULL,
  rol               TEXT    NOT NULL CHECK (rol IN ('admin','determinado','sobrecarga')),
  estado            TEXT    NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','aprobado','rechazado','inactivo')),
  permisos          TEXT    NOT NULL DEFAULT '{"crear":true,"leer":true,"actualizar":true,"eliminar":true}'
                            CHECK (json_valid(permisos)),
  debe_cambiar_clave INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar_clave IN (0,1)),
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta   TEXT,
  ultimo_acceso     TEXT,
  creado_en         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_usuarios_estado ON usuarios(estado);
CREATE INDEX IF NOT EXISTS ix_usuarios_rol    ON usuarios(rol);

-- Refresh tokens (rotativos) para sesiones web y móviles.
CREATE TABLE IF NOT EXISTS sesiones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash   TEXT    NOT NULL UNIQUE,
  expira_en    TEXT    NOT NULL,
  revocada     INTEGER NOT NULL DEFAULT 0 CHECK (revocada IN (0,1)),
  cliente      TEXT,
  creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON sesiones(usuario_id);

-- Solicitudes de recuperación de contraseña atendidas por el administrador
-- (el sistema es local y no depende de un servidor de correo).
CREATE TABLE IF NOT EXISTS recuperaciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL COLLATE NOCASE,
  estado       TEXT    NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente','atendida','rechazada')),
  nota         TEXT,
  creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atendido_por INTEGER REFERENCES usuarios(id),
  atendido_en  TEXT
);
CREATE INDEX IF NOT EXISTS ix_recuperaciones_estado ON recuperaciones(estado);

-- ---------------------------------------------------------------------
-- Profesores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profesores (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  no_trabajador     TEXT    NOT NULL UNIQUE,
  nombre            TEXT    NOT NULL,
  ci                TEXT    NOT NULL UNIQUE,
  anio              TEXT,
  area              TEXT    NOT NULL DEFAULT 'Facultad de Ciencias Técnicas',
  area_ciencia      TEXT    NOT NULL DEFAULT 'Ingeniería en Informática',
  categoria_poc     TEXT    NOT NULL DEFAULT 'Profesor'
                            CHECK (categoria_poc IN ('Profesor','Cuadros')),
  categoria_docente TEXT    NOT NULL
                            CHECK (categoria_docente IN ('Titular','Auxiliar','Asistente','Instructor','ATD Nivel superior','ATD Nivel medio','Recién graduados')),
  carga_horaria     REAL    NOT NULL DEFAULT 8 CHECK (carga_horaria >= 0 AND carga_horaria <= 60),
  correo            TEXT,
  telefono          TEXT,
  activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_profesores_activo ON profesores(activo);
CREATE INDEX IF NOT EXISTS ix_profesores_categoria ON profesores(categoria_docente);
CREATE INDEX IF NOT EXISTS ix_profesores_nombre ON profesores(nombre);

-- ---------------------------------------------------------------------
-- Períodos y carga docente por corte (prenómina)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS periodos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT    NOT NULL UNIQUE,
  inicio    TEXT    NOT NULL,
  fin       TEXT    NOT NULL,
  cortes    INTEGER NOT NULL DEFAULT 14 CHECK (cortes BETWEEN 1 AND 26),
  estado    TEXT    NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),
  creado_en TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Horas impartidas por profesor en cada corte del período.
CREATE TABLE IF NOT EXISTS cargas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_id  INTEGER NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  profesor_id INTEGER NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  corte       INTEGER NOT NULL CHECK (corte >= 1),
  horas       REAL    NOT NULL DEFAULT 0 CHECK (horas >= 0 AND horas <= 200),
  UNIQUE (periodo_id, profesor_id, corte)
);
CREATE INDEX IF NOT EXISTS ix_cargas_periodo ON cargas(periodo_id);

-- ---------------------------------------------------------------------
-- Tarifas (Resolución 210/2023 - parametrizables)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarifas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_docente TEXT    NOT NULL
                            CHECK (categoria_docente IN ('Titular','Auxiliar','Asistente','Instructor','ATD Nivel superior','ATD Nivel medio','Recién graduados')),
  tipo              TEXT    NOT NULL CHECK (tipo IN ('determinado','sobrecarga')),
  importe           REAL    NOT NULL CHECK (importe > 0),
  vigente_desde     TEXT    NOT NULL,
  UNIQUE (categoria_docente, tipo, vigente_desde)
);
CREATE INDEX IF NOT EXISTS ix_tarifas_busqueda ON tarifas(categoria_docente, tipo, vigente_desde DESC);

-- ---------------------------------------------------------------------
-- Contratos determinados y por sobrecarga
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo         TEXT    NOT NULL UNIQUE,
  profesor_id    INTEGER NOT NULL REFERENCES profesores(id) ON DELETE RESTRICT,
  tipo           TEXT    NOT NULL CHECK (tipo IN ('determinado','sobrecarga')),
  objeto         TEXT    NOT NULL,
  periodo        TEXT,
  fecha_inicio   TEXT    NOT NULL,
  fecha_fin      TEXT    NOT NULL,
  horas          REAL    NOT NULL CHECK (horas > 0 AND horas <= 2000),
  tarifa_hora    REAL    NOT NULL CHECK (tarifa_hora > 0),
  importe        REAL    NOT NULL CHECK (importe >= 0),
  clausulas      TEXT    NOT NULL DEFAULT '[]',
  estado         TEXT    NOT NULL DEFAULT 'borrador'
                         CHECK (estado IN ('borrador','pendiente','aprobado','activo','completado','rechazado','cancelado')),
  observaciones  TEXT,
  motivo_rechazo TEXT,
  aprobado_por   INTEGER REFERENCES usuarios(id),
  aprobado_en    TEXT,
  creado_por     INTEGER REFERENCES usuarios(id),
  creado_en      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS ix_contratos_estado   ON contratos(estado);
CREATE INDEX IF NOT EXISTS ix_contratos_profesor ON contratos(profesor_id);
CREATE INDEX IF NOT EXISTS ix_contratos_tipo     ON contratos(tipo);

-- ---------------------------------------------------------------------
-- Pagos (uno o varios por contrato)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contrato_id   INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  periodo       TEXT    NOT NULL,
  horas         REAL    NOT NULL CHECK (horas > 0),
  tarifa        REAL    NOT NULL CHECK (tarifa > 0),
  importe       REAL    NOT NULL CHECK (importe >= 0),
  estado        TEXT    NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','aprobado','pagado','anulado')),
  fecha_limite  TEXT    NOT NULL,
  fecha_pago    TEXT,
  aprobado_por  INTEGER REFERENCES usuarios(id),
  aprobado_en   TEXT,
  observaciones TEXT,
  creado_en     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (contrato_id, periodo)
);
CREATE INDEX IF NOT EXISTS ix_pagos_estado   ON pagos(estado);
CREATE INDEX IF NOT EXISTS ix_pagos_contrato ON pagos(contrato_id);

-- ---------------------------------------------------------------------
-- Configuración, auditoría y respaldos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoria (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  email      TEXT,
  accion     TEXT NOT NULL,
  entidad    TEXT,
  entidad_id TEXT,
  detalle    TEXT,
  ip         TEXT,
  user_agent TEXT,
  creado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria(creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_accion ON auditoria(accion);

CREATE TABLE IF NOT EXISTS respaldos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  archivo    TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  creado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------
-- Vistas de apoyo para dashboard y reportes
-- ---------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_prenomina AS
SELECT
  c.periodo_id,
  c.profesor_id,
  p.nombre            AS profesor,
  p.categoria_docente,
  p.carga_horaria,
  SUM(c.horas)        AS thp,
  SUM(CASE WHEN c.horas > p.carga_horaria THEN c.horas - p.carga_horaria ELSE 0 END) AS hsp
FROM cargas c
JOIN profesores p ON p.id = c.profesor_id
GROUP BY c.periodo_id, c.profesor_id;

CREATE VIEW IF NOT EXISTS v_contratos_resumen AS
SELECT estado, tipo, COUNT(*) AS total, COALESCE(SUM(importe),0) AS importe
FROM contratos GROUP BY estado, tipo;

