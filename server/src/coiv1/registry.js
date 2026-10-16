// Módulos de COI V1 que exponen funciones RPC (equivalentes a google.script.run).
// Importaciones estáticas: así el empaquetador de funciones (Vercel) incluye cada archivo.
// Al agregar un módulo nuevo, regístrelo aquí. Los de modules/ van antes que los de arqueos/.
import * as core from './modules/core.js';
import * as granja from './modules/granja.js';
import * as inicio from './modules/inicio.js';
import * as pqr from './modules/pqr.js';
import * as controlArqueos from './arqueos/controlArqueos.js';

export const MODULES = [
  ['modules/core.js', core],
  ['modules/granja.js', granja],
  ['modules/inicio.js', inicio],
  ['modules/pqr.js', pqr],
  ['arqueos/controlArqueos.js', controlArqueos]
];
