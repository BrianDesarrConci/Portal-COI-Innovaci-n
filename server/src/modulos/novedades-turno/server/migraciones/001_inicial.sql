-- Novedades de turno: registro de lo ocurrido en cada turno de oficina y su seguimiento.
CREATE TABLE novedad (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  turno VARCHAR(10) NOT NULL CHECK (turno IN ('manana', 'tarde', 'noche')),
  cliente VARCHAR(80) NOT NULL,
  oficina VARCHAR(120),
  categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('operativa', 'efectivo', 'seguridad', 'tecnologia', 'personal')),
  prioridad VARCHAR(10) NOT NULL CHECK (prioridad IN ('baja', 'media', 'alta')),
  descripcion TEXT NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_gestion', 'cerrada')),
  creado_por VARCHAR(120) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_por VARCHAR(120),
  cerrado_en TIMESTAMPTZ
);
CREATE INDEX novedad_estado ON novedad (estado, prioridad);
CREATE INDEX novedad_fecha ON novedad (fecha DESC);

CREATE TABLE novedad_seguimiento (
  id SERIAL PRIMARY KEY,
  novedad_id INT NOT NULL REFERENCES novedad (id) ON DELETE CASCADE,
  estado VARCHAR(12) NOT NULL,
  comentario TEXT NOT NULL,
  autor VARCHAR(120) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX novedad_seguimiento_novedad ON novedad_seguimiento (novedad_id, creado_en);
