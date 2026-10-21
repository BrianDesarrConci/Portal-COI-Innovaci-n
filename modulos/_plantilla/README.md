# __NOMBRE__

## Qué hace

Qué resuelve, para quién y con qué datos (dos o tres frases).

- **Id:** `__ID__` · ruta `/__ID__` · API `/api/m/__ID__`
- **Responsable:** __AUTOR__ (__CORREO__)
- **Roles:** todos los usuarios con sesión (ajuste según `acceso.roles`).

## Tablas

Base MySQL del portal, prefijo `__PREFIJO__`.

| Tabla | Para qué | Migración |
| --- | --- | --- |
| `__PREFIJO__registro` | Registros del módulo | 001 |

## Endpoints

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/resumen` | todos | Contadores del tablero |
| GET | `/registros` | todos | Lista los registros |
| POST | `/registros` | todos | Crea un registro `{ titulo, detalle }` |
| DELETE | `/registros/:id` | todos | Elimina un registro |

## Roles

Describa qué puede hacer cada rol (p. ej. solo `lider` aprueba).

## Cambios de esta versión

- 0.1.0: versión inicial.
