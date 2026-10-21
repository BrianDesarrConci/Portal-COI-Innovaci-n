# Novedades de turno

Bitácora de los turnos de las oficinas: qué pasó, en qué cliente y oficina, con qué prioridad, quién lo
atiende y cómo se cerró. Es el módulo de ejemplo de la plataforma de módulos de COI: muestra el contrato
completo (manifiesto, API, migraciones, interfaz con `@coi/sdk` y pruebas).

- **Ruta:** `/novedades-turno` · API `/api/m/novedades-turno`
- **Base de datos:** PostgreSQL (`DB_NOVEDADES_TURNO_URL`). Sin la variable usa PostgreSQL embebido con datos de ejemplo.
- **Roles:** todos los usuarios con sesión; reabrir una novedad cerrada exige el rol `lider` (o `admin`).

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/resumen` | Abiertas, en gestión, prioridad alta, cerradas hoy, categorías y clientes con más casos |
| GET | `/novedades?estado=activas&q=` | Listado (`activas`, `abierta`, `en_gestion`, `cerrada`, `todas`) |
| GET | `/novedades/:id` | Detalle con seguimiento |
| POST | `/novedades` | `{ turno, cliente, oficina, categoria, prioridad, descripcion }` |
| POST | `/novedades/:id/seguimiento` | `{ estado, comentario }` |

## Cambios

- 1.0.0: versión inicial.
