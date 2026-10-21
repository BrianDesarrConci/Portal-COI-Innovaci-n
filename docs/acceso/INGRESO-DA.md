# Ingreso al portal COI con el API DA

## Cómo funciona

1. La pantalla de ingreso pide **usuario y clave** corporativos.
2. El servidor de COI los envía a DA (`DA_RUTA_LOGIN`). La clave nunca se guarda ni se registra.
3. Si DA exige segundo factor, COI pide el **código de verificación** y lo valida con DA (`DA_RUTA_VERIFICAR`).
4. Con la respuesta de DA, COI abre una sesión propia: una cookie firmada, `HttpOnly`, válida 8 horas.
   La cookie lleva el usuario (id, nombre, correo, cargo y roles) y, si cabe, el token de DA.
5. Cada ingreso, rechazo y salida queda en el registro de accesos (`GET /api/admin/accesos`, solo administradores).

Con el proveedor DA activo, todo `/api` exige sesión, salvo `/api/health` y `/api/auth/*`.
Además, cada módulo puede limitar su acceso por roles en su `module.json`.

## Qué cambia cuando llegue la documentación

Todo lo específico de DA está en `server/src/auth/proveedores/da.js`:

| Punto | Función | Hoy (supuesto) |
| --- | --- | --- |
| Rutas | variables `DA_RUTA_LOGIN`, `DA_RUTA_VERIFICAR` | `POST /auth/login`, `POST /auth/verificar` |
| Credencial de COI ante DA | `DA_API_KEY` en el encabezado `DA_API_KEY_HEADER` | `x-api-key` |
| Cuerpo de las peticiones | `pedir(...)` | `{ usuario, clave }` y `{ transaccion, usuario, codigo }` |
| Segundo factor | `leerDesafio` | campo `requiereCodigo` / `transaccion` |
| Datos del usuario | `mapearUsuario` | acepta `usuario`/`user`, `nombre`/`name`, `correo`/`email`, `roles`/`perfiles`/`groups` |
| Roles | `DA_MAPA_ROLES` | perfil de DA → rol de COI |

Si DA usa redirección (OAuth 2.0 / OpenID Connect) en lugar de usuario y clave, se agregan dos rutas
(`/api/auth/da/iniciar` y `/api/auth/da/retorno`) en el mismo proveedor. La sesión, los permisos y el
resto del portal no cambian.

## Preguntas para Tecnología

1. URL base de DA por ambiente (pruebas y producción) y si es accesible desde Vercel (IP fija o lista blanca).
2. Tipo de autenticación: usuario y clave por API, o redirección OAuth/OpenID Connect.
3. Credencial del aplicativo COI ante DA (API key, client id/secret) y cómo se envía.
4. Segundo factor: si DA lo maneja, por qué canal (correo, SMS, autenticador) y longitud del código.
5. Respuesta de un ingreso correcto: campos del usuario, perfiles o roles, token y vigencia.
6. Códigos de error (clave errada, usuario bloqueado, clave vencida) y mensajes.
7. Cierre de sesión en DA (si existe) y renovación del token.
8. Usuarios de prueba con distintos perfiles.

## Pruebas

- `server/test/auth.test.js` simula DA y prueba ingreso directo, segundo factor, clave o código errados,
  DA caído, cookie alterada, mapa de roles y bloqueo del API sin sesión.
- Para probar contra DA real:
  `AUTH_PROVEEDOR=da DA_BASE_URL=... DA_API_KEY=... COI_SESSION_SECRET=... npm run dev`.
