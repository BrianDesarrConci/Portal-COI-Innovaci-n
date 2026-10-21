// Archivo generado por `npm run modulos:sync` a partir de los módulos instalados. No editar a mano.
import registrar_novedades_turno from './novedades-turno/server/index.js';

export const MODULOS = [
  {
    manifiesto: {
      "id": "novedades-turno",
      "nombre": "Novedades de turno",
      "version": "1.0.0",
      "descripcion": "Bitácora de los turnos de las oficinas: qué pasó, quién lo atiende y cómo se cerró.",
      "autor": {
        "nombre": "Equipo de Innovación COI",
        "correo": "innovacion@multival.com.co"
      },
      "menu": {
        "grupo": "Operación",
        "etiqueta": "Novedades de turno",
        "icono": "clock",
        "orden": 10
      },
      "acceso": {
        "roles": []
      },
      "db": {
        "motor": "postgres",
        "variable": "DB_NOVEDADES_TURNO_URL"
      },
      "dependencias": {
        "server": {},
        "client": {}
      }
    },
    registrar: registrar_novedades_turno,
    migraciones: [
      { nombre: '001_inicial.sql', url: new URL('./novedades-turno/server/migraciones/001_inicial.sql', import.meta.url) },
    ],
  },
];
