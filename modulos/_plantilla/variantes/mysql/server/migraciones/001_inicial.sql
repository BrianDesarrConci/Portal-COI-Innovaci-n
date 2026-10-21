-- Primera versión de la base de datos del módulo __NOMBRE__ (MySQL).
-- Nunca edite una migración ya aplicada: cree 002_..., 003_... con los cambios.
CREATE TABLE registro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  detalle TEXT,
  creado_por VARCHAR(120) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX registro_creado_en (creado_en)
);
