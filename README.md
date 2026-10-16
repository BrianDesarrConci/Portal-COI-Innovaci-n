# COI · Gestión y Monitoreo de Apoyo al Negocio

Portal de la Gerencia de Gestión del Negocio (Reval S.A.S. · Multipagas S.A.S.) para operar y
monitorear los 16 clientes y las 104 actividades del área de Apoyo al Negocio.

Es la migración a **React + Node.js** del demo construido en Google Apps Script
("DEMO APOYO AL NEGOCIO"). El código original se conserva como referencia en
[`docs/referencia-gas/`](docs/referencia-gas/).

## Arquitectura

```
.
├── server/                 API en Node.js (Express, ESM)
│   ├── src/app.js          Rutas: /api/health, /api/catalog, /api/modules/:vista, /api/traza
│   ├── src/data/           Catálogo (clientes, actividades, analistas, procesos, ANS) y datos por módulo
│   ├── src/routes/         Rutas con persistencia (TRAZA)
│   ├── src/store/          Almacén JSON en disco (fase inicial, sin motor de base de datos)
│   └── test/               Pruebas con node:test
├── client/                 Aplicación React (Vite + react-router)
│   └── src/
│       ├── layout/         Ingreso, menú lateral, barra superior y búsqueda (Ctrl K)
│       ├── components/     Librería de UI (KPI, tarjetas, tablas, gráficos, modales, avisos)
│       ├── context/        Estado global: modelo del día, navegación y cliente en contexto
│       ├── lib/            Formato, simulación determinística, menú y cliente HTTP
│       └── views/          Una vista por módulo (N0…N9, G1…G6, TRAZA)
└── docs/referencia-gas/    Demo original en Apps Script
```

Node sirve el API y la interfaz desde **un solo puerto** (4000): en desarrollo monta Vite como
middleware (con recarga en caliente) y en producción sirve el build de React. Así funciona igual en
local y en StackBlitz.

## Módulos

| Grupo | Vistas |
| --- | --- |
| COI V1 Opciones | Migración completa de COI V1: Inicio, Granja de Usuarios (bajas y backups), Experiencia de Cliente (PQR), Centro de captura, Control de Arqueos (registro FOR-GOR, gestión, normalizaciones, tableros, analítica y tendencias), Brain RT y Administración (usuarios y permisos) |
| Monitoreo | Tablero gerencial (N0), Analistas, Procesos, Clientes (ANS y evaluaciones), Catálogo de actividades, Bitácora |
| Operación | Validación documental (N1), Novedades (N2), PQR y encuestas (N3), Alertas (N4), Oficinas (N7), Fincomercio (N8) |
| Cifras | Reportería y comités (N5), Facturación (N6), Transacciones en vivo (N9) |
| Módulos Apps Script | Malas prácticas (G1), Papelería (G2), Usuarios y planta (G3), Cheques y arqueos (G4), Banco Agrario (G5), Correo de ingresos (G6) |
| Herramientas | TRAZA (solicitudes con bitácora real), Plan de implementación |

## COI V1 sobre Google Sheets

Los módulos de COI V1 conservan sus bases de Google Sheets y su lógica de Apps Script:

- `server/src/coiv1/spreadsheet.js` reproduce `SpreadsheetApp` (filas como arreglos, índices desde 1)
  y `server/src/coiv1/gas.js` los servicios `Utilities`, `LockService`, `CacheService`, `MailApp`, etc.
- `POST /api/coiv1/rpc/<función>` equivale a `google.script.run`: mismos nombres, parámetros y respuestas
  que `Código.gs` (fuente de referencia en `docs/referencia-coi-v1/`, sin secretos).
- **Datos:** por defecto, copia de los libros COI V1, Granja de Usuarios y Directorio Nacional en
  `server/src/data/coiv1` (sin contraseñas; cédulas, teléfonos y correos personales enmascarados).
  Con `GOOGLE_SERVICE_ACCOUNT_JSON` (cuenta de servicio con acceso a los libros) se usa Google Sheets en vivo.
- En la demo los correos no se envían: quedan en la bandeja de salida (Administración) y los soportes
  generados se sirven desde `/api/coiv1/files`.
- Permisos como en V1: los usuarios no ADMIN ven todo; a los ADMIN se les ocultan los módulos en NO de la
  hoja PERMISOS. Control de Arqueos también admite la entrada propia con la llave de arqueos.

## Uso

Requiere Node.js 18.18 o superior.

**StackBlitz:** abra el repositorio (stackblitz.com/github/…); `.stackblitzrc` instala y ejecuta
`npm run dev` solo, y la vista previa aparece en el panel de StackBlitz (no en `localhost`).

```bash
npm install        # instala server y client (workspaces)
npm run dev        # desarrollo: abra http://localhost:4000
npm test           # pruebas del API
npm run build      # build de React en client/dist
npm start          # producción: compila React y Node sirve todo en http://localhost:4000
```

Variables de entorno (ver `.env.example`): `PORT`, `DATA_DIR` (carpeta de la base JSON de TRAZA) y,
en el cliente, `VITE_LOGO_REVAL_URL` / `VITE_LOGO_MULTIPAGAS_URL` para los logos oficiales.

## Estado

Fase 1: migración completa de la interfaz del demo y API base. Los módulos operativos aún sirven
datos de demostración desde `server/src/data/modules`; TRAZA ya persiste solicitudes y bitácora.
Próximos pasos: autenticación corporativa, base de datos (MySQL/PostgreSQL), conexión con PTR,
Google Sheets/Drive y automatizaciones n8n.
