# Novedades de turno (módulo de ejemplo)

## Qué hace

Bitácora de los turnos de las oficinas: qué pasó, en qué cliente y oficina, con qué prioridad, quién lo
atiende y cómo se cerró. **No está instalado en el portal**: es la referencia del contrato de módulos
(manifiesto, API, migraciones MySQL, interfaz con `@coi/sdk`, estados vacíos y pruebas). Cópiele las ideas.

- **Id:** `novedades-turno` (`"nuevo": true`, no está en el plan) · API `/api/m/novedades-turno`
- **Responsable:** Equipo de Innovación COI (innovacion@multival.com.co)

## Tablas

Base MySQL del portal, prefijo `nt_`.

| Tabla | Para qué | Migración |
| --- | --- | --- |
| `nt_novedad` | Una fila por novedad de turno | 001 |
| `nt_seguimiento` | Historial de estados y comentarios de cada novedad | 001 |

## Endpoints

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/resumen` | todos | Abiertas, en gestión, prioridad alta, cerradas hoy, categorías y clientes con más casos |
| GET | `/novedades?estado=activas&q=` | todos | Listado (`activas`, `abierta`, `en_gestion`, `cerrada`, `todas`) |
| GET | `/novedades/:id` | todos | Detalle con seguimiento |
| POST | `/novedades` | todos | `{ turno, cliente, oficina, categoria, prioridad, descripcion }` |
| POST | `/novedades/:id/seguimiento` | todos; reabrir: `lider` | `{ estado, comentario }` |

## Roles

Todos los usuarios con sesión registran y gestionan novedades. Reabrir una novedad cerrada exige el rol
`lider` (o `admin`).

## Cambios de esta versión

- 1.1.0: MySQL con prefijo `nt_`, sin datos de ejemplo, estados vacíos y aviso de base pendiente de configurar.
- 1.0.0: versión inicial.
