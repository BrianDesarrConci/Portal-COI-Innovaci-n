-- Primera versión de las tablas del módulo __NOMBRE__.
-- Reglas: toda tabla empieza por el prefijo "__PREFIJO__", InnoDB y utf8mb4.
-- Nunca edite una migración ya aplicada: cree 002_..., 003_... con los cambios.
CREATE TABLE __PREFIJO__registro (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  detalle TEXT NULL,
  creado_por VARCHAR(120) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX __PREFIJO__registro_creado (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
