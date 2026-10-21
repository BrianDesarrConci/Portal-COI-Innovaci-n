// Archivo generado por `npm run modulos:sync` a partir de los módulos instalados. No editar a mano.
import { lazy } from 'react';

export const MODULOS = [
  {
    ...{
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
      }
    },
    Componente: lazy(() => import('./novedades-turno/index.jsx')),
  },
];
