# Guía para analistas: cómo construir un módulo de COI

Cada analista construye su módulo por separado y lo entrega en un **.zip**. Innovación lo valida, lo
integra al portal con un solo comando y lo publica. Esta guía explica cómo hacerlo para que el módulo
entre a la primera.

> Módulo de referencia: **Novedades de turno** (`server/src/modulos/novedades-turno` y
> `client/src/modulos/novedades-turno`). Cópiele las ideas.

---

## 1. Prepare su equipo

Necesita Node.js 18.18 o superior y una copia del repositorio de COI.

```bash
npm install          # una sola vez
npm run modulo:nuevo -- control-remesas --nombre "Control de remesas" --grupo "Operación" --autor "Su nombre"
npm run dev          # abra http://localhost:4000/control-remesas
```

`modulo:nuevo` crea el módulo desde la plantilla y lo agrega al menú. Opciones:

| Opción | Valores | Por defecto |
| --- | --- | --- |
| `--motor` | `postgres`, `mysql`, `ninguna` | `postgres` |
| `--grupo` | grupo del menú (Monitoreo, Operación, Cifras, …) o uno nuevo | `Operación` |
| `--nombre`, `--autor` | texto | a partir del id |

El **id** del módulo usa minúsculas, números y guiones (`control-remesas`). Es la ruta del portal
(`/control-remesas`) y la del API (`/api/m/control-remesas`); no puede repetir una vista del portal.

Sin base de datos configurada, un módulo PostgreSQL usa **PostgreSQL embebido** (se guarda en
`server/var/modulos/<id>`): no necesita instalar nada para desarrollar.

## 2. Dónde queda cada cosa

Mientras desarrolla, su módulo vive en dos carpetas (el portal se publica como dos servicios):

```
server/src/modulos/<id>/
  module.json                 manifiesto: nombre, versión, menú, roles y base de datos
  README.md                   qué hace el módulo y su API
  server/index.js             API del módulo
  server/migraciones/*.sql    estructura de su base de datos
  test/*.test.js              pruebas
client/src/modulos/<id>/
  index.jsx                   pantalla principal
  *.jsx, *.css                resto de la interfaz
```

Solo trabaje dentro de esas dos carpetas. No modifique archivos del portal: si necesita algo del
portal que no está en `@coi/sdk`, pídalo a Innovación.

## 3. El manifiesto (`module.json`)

```json
{
  "id": "control-remesas",
  "nombre": "Control de remesas",
  "version": "1.0.0",
  "descripcion": "Seguimiento de remesas por oficina y transportadora.",
  "autor": { "nombre": "Ana Pérez", "correo": "ana.perez@reval.com.co" },
  "menu": { "grupo": "Operación", "etiqueta": "Control de remesas", "icono": "wallet", "orden": 20 },
  "acceso": { "roles": ["lider", "analista"] },
  "db": { "motor": "postgres", "variable": "DB_CONTROL_REMESAS_URL" },
  "dependencias": { "server": {}, "client": {} }
}
```

- **version**: semver. Cada entrega nueva sube la versión (1.0.0 → 1.0.1 corrección, 1.1.0 función nueva).
- **menu.icono**: home, users, layers, building, filecheck, inbox, message, bell, chart, receipt, store,
  pin, activity, box, flow, list, flag, search, clock, check, alert, mail, chat, form, ticket, eye,
  shield, sparkle, lock, upload, file, star, pen, package, wallet, usercheck, send, warn.
- **acceso.roles**: roles que llegan del ingreso corporativo (API DA). Lista vacía = todos los usuarios
  con sesión. El rol `admin` siempre entra. Quien no tiene el rol no ve el módulo en el menú y el API le
  responde 403.
- **db.variable**: `DB_<ID>_URL`. Cada módulo tiene su **propia** base de datos.
- **dependencias**: paquetes npm adicionales. Solo se aceptan los aprobados por Innovación (hoy `dayjs`
  y `zod`); si necesita otro, pídalo antes de usarlo.

## 4. La interfaz (`client/index.jsx`)

```jsx
import { Card, Kpis, Loading, PageHead, Table, useRecurso } from '@coi/sdk';
import './control-remesas.css';

export default function Modulo({ sub, usuario, api }) {
  const remesas = useRecurso(api, '/remesas');           // GET /api/m/control-remesas/remesas
  if (!remesas.data) return <Loading error={remesas.error} />;
  return (
    <>
      <PageHead title="Control de remesas" sub="…" />
      <Kpis items={[['Remesas hoy', remesas.data.length, 'Despachadas', 'wallet']]} />
      <Card title="Remesas" flush><Table headers={['Oficina', 'Valor']} rows={…} /></Card>
    </>
  );
}
```

El portal le entrega:
- `usuario`: `{ id, nombre, correo, roles }` de quien tiene la sesión.
- `api`: cliente HTTP de su módulo: `api.get('/x')`, `api.post('/x', datos)`, `api.put`, `api.patch`, `api.del`.
- `sub`: segundo tramo de la ruta (`/control-remesas/<sub>`) para subpantallas.

Solo puede importar `react`, `react-router-dom` y **`@coi/sdk`**, que trae:

| Grupo | Elementos |
| --- | --- |
| Diseño | `PageHead`, `Kpi`, `Kpis`, `Card`, `Table`, `Cell`, `Tabs`, `Tag`, `Bar`, `HBars`, `LineChart`, `Spark`, `ListRow`, `DocRow`, `Field`, `fieldStyle`, `areaStyle`, `Loading`, `Icon`, `CountUp` |
| Interacción | `useOverlay()` → `toast(msg)`, `modal({ title, body })`, `closeModal(msg)`; `useApp()` → `go('ruta')` |
| Sesión | `useAuth()`, `puedeAcceder(usuario, roles)` |
| Datos | `crearApi(id)`, `useRecurso(api, ruta)` → `{ data, error, loading, reload }`, `CLIENTES`, `SEGMENTOS` |
| Formato | `fmt`, `pct`, `money`, `longDate`, `shortDate`, `cap`, `norm` |

**Marca:** use los componentes del SDK y las variables de color del portal (`var(--navy)`, `var(--green)`,
`var(--cyan)`, `var(--gold)` solo como acento, `var(--line)`, `var(--muted)`). No traiga otras fuentes ni
logos. Prefije **todas** sus clases CSS con el id del módulo (`.control-remesas-tabla`) para no afectar
otras pantallas. Revise que la pantalla funcione en celular (390 px de ancho).

## 5. El API (`server/index.js`)

```js
const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });

export default async function registrar({ router, db, config, log, acceso }) {
  router.get('/remesas', async (req, res) => {
    const { rows } = await db.query('SELECT * FROM remesa WHERE fecha = $1 ORDER BY id', [req.query.fecha]);
    res.json(rows);
  });
  router.post('/remesas', async (req, res) => {
    if (!req.body.oficina) throw fallo(400, 'Indique la oficina.');
    // …
  });
}
```

- Las rutas son relativas a `/api/m/<id>`. El portal ya verificó la sesión y el rol; `req.usuario` es el usuario.
- Puede usar funciones `async` y lanzar errores: un error con `status` 4xx se muestra al usuario con su
  mensaje; cualquier otro responde 500 sin detalles internos.
- `db.query(sql, parámetros)` → `{ rows }`. **Siempre** con parámetros (`$1, $2` en PostgreSQL, `?` en MySQL),
  nunca concatenando texto del usuario en el SQL.
- `db.transaccion(async (tx) => { await tx.query(…); })` para varias escrituras que van juntas.
- `config.env('NOMBRE')` lee la variable de entorno `MOD_<ID>_NOMBRE` (URLs y llaves de servicios externos).
- `acceso.puedeAcceder(req.usuario, ['lider'])` para permisos finos dentro del módulo.
- `log.info / log.warn / log.error` para registros.

No se permite: `child_process`, `eval`, `process.exit`, leer `process.env` directamente, guardar
archivos en disco (en la nube el disco se borra) ni credenciales en el código.

## 6. Base de datos y migraciones

La estructura de su base de datos se define con archivos SQL numerados en `server/migraciones/`:

```
001_inicial.sql        CREATE TABLE remesa (...);
002_transportadora.sql ALTER TABLE remesa ADD COLUMN transportadora VARCHAR(80);
```

- Se aplican en orden y una sola vez; quedan registradas en la tabla `coi_migraciones` de su base.
- **Nunca edite una migración que ya se aplicó**: el portal la rechaza. Cree la siguiente (`003_…`).
- Diseñe el modelo relacional completo: llaves primarias, foráneas (`REFERENCES`), `CHECK` e índices.
- PostgreSQL es el motor recomendado. Con MySQL tenga en cuenta que `CREATE/ALTER` no se pueden
  deshacer dentro de una transacción.
- `npm run modulos:migrar -- <id>` aplica las migraciones a mano (con la variable `DB_<ID>_URL` apunta a
  la base real; sin ella, a la embebida).
- Para empezar de cero en su equipo borre `server/var/modulos/<id>`.

## 7. Pruebas

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { probarModulo } from '#coi/pruebas';

let m;
before(async () => { m = await probarModulo(new URL('..', import.meta.url)); });
after(() => m.cerrar());

test('crea una remesa', async () => {
  const r = await m.pedir('POST', '/remesas', { oficina: 'Salitre', valor: 1000000 });
  assert.equal(r.status, 201);
});
test('un analista no puede anular', async () => {
  const r = await m.pedir('DELETE', '/remesas/1', undefined, { como: { id: 'x', nombre: 'X', roles: ['analista'] } });
  assert.equal(r.status, 403);
});
```

`probarModulo` levanta su API con una base PostgreSQL nueva en memoria y las migraciones aplicadas.
`npm test` corre las pruebas del portal y las de todos los módulos. Pruebe al menos: creación, validación
(400), permisos (403) y sin sesión (401, `{ como: 'anonimo' }`).

## 8. Entregue el módulo

```bash
npm run modulo:validar -- control-remesas      # revisa el contrato (lo mismo que hará Innovación)
npm test
npm run modulo:empaquetar -- control-remesas   # crea control-remesas-1.0.0.zip
```

Envíe el `.zip` a Innovación. Allí se ejecuta:

```bash
npm run modulo:importar -- control-remesas-1.0.0.zip              # primera vez
npm run modulo:importar -- control-remesas-1.1.0.zip --reemplazar # versión nueva (respalda la anterior)
```

### Lista de chequeo antes de enviar

- [ ] `npm run modulo:validar` sin errores y `npm test` en verde.
- [ ] `version` subió respecto a la entrega anterior y el README tiene la nota del cambio.
- [ ] Sin credenciales, `.env`, `node_modules` ni archivos fuera de las carpetas del módulo.
- [ ] Migraciones nuevas en archivos nuevos; ninguna migración aplicada fue editada.
- [ ] Roles de `acceso.roles` acordados con el líder del proceso.
- [ ] Pantalla revisada en computador y celular, con la línea gráfica del portal.
- [ ] Datos personales (cédulas, teléfonos, correos personales) solo si el proceso los exige, y nunca en los registros (`log`).

## 9. Qué valida el importador

| Bloquea la importación | Solo avisa |
| --- | --- |
| id inválido o que choca con el portal u otro módulo | icono inexistente (usa `box`) |
| manifiesto incompleto, versión no semver o no mayor al reemplazar | grupo de menú nuevo |
| variable de BD repetida con otro módulo | `process.env` en el servidor |
| archivos ocultos (`.env`), `node_modules`, `package.json`, carpetas no permitidas | escritura en disco |
| secretos: llaves privadas, llaves de API, cadenas de conexión con contraseña | `dangerouslySetInnerHTML`, `fetch` a servicios externos desde el navegador |
| importaciones fuera del módulo, internas del portal o no aprobadas | migraciones con numeración salteada |
| `child_process`, `eval`, `process.exit` | falta README o correo del autor |
| migraciones mal nombradas o fuera de `server/migraciones/` | |
