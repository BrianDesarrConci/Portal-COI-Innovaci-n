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
│   ├── src/app.js          Rutas: /api/health, /api/auth, /api/catalog, /api/modules/:vista, /api/traza, /api/m
│   ├── src/auth/           Ingreso: sesión firmada, proveedores DA y demo, registro de accesos
│   ├── src/modulos/        Módulos de los analistas (uno por carpeta) y su capa de base de datos
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
│       ├── views/          Una vista por módulo (N0…N9, G1…G6, TRAZA)
│       ├── modulos/        Interfaz de los módulos de los analistas
│       └── sdk/            @coi/sdk: lo que un módulo puede usar del portal (UI, API, sesión)
├── modulos/_plantilla/     Plantilla del .zip que entrega cada analista
├── scripts/modulos/        Crear, validar, importar y empaquetar módulos
└── docs/                   Guía de analistas, ingreso con DA y referencias de Apps Script
```

Node sirve el API y la interfaz desde **un solo puerto** (4000): en desarrollo monta Vite como
middleware (con recarga en caliente) y en producción sirve el build de React. Así funciona igual en
local y en StackBlitz.

## Organización del portal

| Grupo del menú | Opciones |
| --- | --- |
| Monitoreo | Tablero gerencial (con la franja «Operación en vivo» de datos reales), Analistas, Procesos, Clientes (portafolio y espacio Cliente 360 por cliente), Catálogo de actividades, Bitácora |
| COI V1 Opciones | Inicio COI V1, Granja de Usuarios, Experiencia de Cliente, Centro de captura, Control de Arqueos, Brain RT, Administración |
| Operación | Validación documental (N1), Novedades (N2), PQR y encuestas (N3), Alertas (N4), Fincomercio (N8), Oficinas (N7) |
| Cifras | Reportería y comités (N5), Facturación (N6), Transacciones en vivo (N9) |
| Módulos Apps Script | Malas prácticas (G1), Papelería (G2), Usuarios y planta (G3), Cheques y arqueos (G4), Banco Agrario (G5), Correo de ingresos (G6) |
| Herramientas | TRAZA, Plan de implementación |

Desde «Clientes» se abre el espacio Cliente 360 de cada uno de los 19 clientes (`client/src/lib/clientes.js`),
con su red de oficinas, personal, arqueos, acuerdo de servicio y, si lo tiene, su módulo especializado.

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

## Ingreso (API DA)

El ingreso lo valida el servidor (`/api/auth`) y abre una sesión en una cookie firmada de 8 horas.
Con `AUTH_PROVEEDOR=da` (o `DA_BASE_URL` definida) se ingresa con usuario y clave de DA y, si DA lo pide,
un código de verificación; todo `/api` exige sesión. Sin DA configurado se usa el ingreso de demostración.
Detalle, variables y preguntas pendientes para Tecnología: [`docs/acceso/INGRESO-DA.md`](docs/acceso/INGRESO-DA.md).

## Módulos de los analistas

Cada analista desarrolla su módulo por separado, con su propia base de datos relacional (PostgreSQL o MySQL),
y lo entrega como `.zip`. Para integrarlo:

```bash
npm run modulo:importar -- ruta/al/modulo.zip   # valida, instala y registra el módulo
npm test && npm run build                        # pruebas del portal y del módulo
```

El módulo aparece en el menú según su `module.json`, responde en `/api/m/<id>` y solo lo ven los roles
que declare. Su base se configura con la variable `DB_<ID>_URL`; las migraciones SQL se aplican solas.
Guía completa: [`docs/modulos/GUIA-ANALISTAS.md`](docs/modulos/GUIA-ANALISTAS.md).

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

### Vercel

`vercel.json` define dos servicios en un solo proyecto (un dominio):

| Servicio | Carpeta | Tipo | Ruta pública |
| --- | --- | --- | --- |
| `client` | `client/` | Vite (React, estático, con fallback a `index.html`) | `/(.*)` |
| `server` | `server/` | Express (función, entrada `server/server.js`) | `/api/(.*)` |

El navegador llama al API con rutas relativas (`/api/...`) en el mismo dominio, así que no hay llamadas
entre servicios ni *bindings*. En Vercel el disco solo permite escribir en `/tmp`: las escrituras de la
demo (TRAZA, cambios sobre la copia de Sheets, bandeja de salida, archivos) son efímeras. Para datos
persistentes configure `GOOGLE_SERVICE_ACCOUNT_JSON` (Google Sheets en vivo).

Servicios externos (n8n, API de PTR, etc.): no son servicios de este proyecto de Vercel, así que no usan
*bindings*; su URL y credenciales van en variables de entorno del proyecto (`N8N_BASE_URL`, `N8N_API_KEY`,
ver `.env.example`) y el servidor las lee con `process.env`. Si alguno se despliega dentro de este mismo
proyecto como servicio, se agrega en `vercel.json` con un binding en el servicio `server`.

Variables de entorno (ver `.env.example`): `PORT`, `DATA_DIR` (carpeta de la base JSON de TRAZA) y,
en el cliente, `VITE_LOGO_REVAL_URL` / `VITE_LOGO_MULTIPAGAS_URL` para los logos oficiales.

## Estado

Fase 1: migración completa de la interfaz del demo y API base. Los módulos operativos aún sirven
datos de demostración desde `server/src/data/modules`; TRAZA ya persiste solicitudes y bitácora.
Fase 2 (hito del 30 de octubre): ingreso con DA y plataforma para integrar los módulos de COI V1 que
desarrollan los analistas, cada uno con su base de datos. Pendiente: conectar DA real con su documentación.
