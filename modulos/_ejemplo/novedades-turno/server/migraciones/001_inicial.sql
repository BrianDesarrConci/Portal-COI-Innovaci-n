-- Novedades de turno: lo ocurrido en cada turno de oficina y su seguimiento.
CREATE TABLE nt_novedad (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  turno VARCHAR(10) NOT NULL,
  cliente VARCHAR(80) NOT NULL,
  oficina VARCHAR(120) NULL,
  categoria VARCHAR(20) NOT NULL,
  prioridad VARCHAR(10) NOT NULL,
  descripcion TEXT NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'abierta',
  creado_por VARCHAR(120) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_por VARCHAR(120) NULL,
  cerrado_en DATETIME NULL,
  INDEX nt_novedad_estado (estado, prioridad),
  INDEX nt_novedad_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE nt_seguimiento (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  novedad_id INT UNSIGNED NOT NULL,
  estado VARCHAR(12) NOT NULL,
  comentario TEXT NOT NULL,
  autor VARCHAR(120) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX nt_seguimiento_novedad (novedad_id, creado_en),
  CONSTRAINT nt_seguimiento_fk FOREIGN KEY (novedad_id) REFERENCES nt_novedad (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
