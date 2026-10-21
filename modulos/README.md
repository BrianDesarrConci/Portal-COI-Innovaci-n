# Módulos de los analistas

- `_plantilla/`: plantilla que usa `npm run modulo:nuevo` (estructura del .zip que entrega cada analista).
- `_ejemplo/novedades-turno/`: módulo de referencia completo (MySQL con prefijo `nt_`, estados vacíos, pruebas).
  **No está instalado en el portal**; sus pruebas corren con `npm test`.
- `.respaldos/`: versiones anteriores que guarda `npm run modulo:importar -- <zip> --reemplazar` (no se versiona).
- `package.json`: solo hace que el ejemplo y la plantilla sean módulos ES y resuelvan `#coi/pruebas`.

Los módulos instalados viven en `server/src/modulos/<id>` y `client/src/modulos/<id>`, y usan tablas con
su prefijo en la base MySQL del portal (`COI_MYSQL_URL`).
Guía completa: [docs/modulos/GUIA-ANALISTAS.md](../docs/modulos/GUIA-ANALISTAS.md).
