-- Primera versión de la base de datos del módulo __NOMBRE__.
-- Nunca edite una migración ya aplicada: cree 002_..., 003_... con los cambios.
CREATE TABLE registro (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  detalle TEXT,
  creado_por VARCHAR(120) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX registro_creado_en ON registro (creado_en DESC);
