// Registro de vistas: la ruta /:vista/:sub muestra el componente correspondiente.
import Inicio from './Inicio.jsx';
import Analistas from './Analistas.jsx';
import Analista from './Analista.jsx';
import Procesos from './Procesos.jsx';
import Clientes from './Clientes.jsx';
import Cliente from './Cliente.jsx';
import Catalogo from './Catalogo.jsx';
import Bitacora from './Bitacora.jsx';
import Pqr from './Pqr.jsx';
import Traza from './Traza.jsx';
import Implementacion from './Implementacion.jsx';
import Coiv1Inicio from './coiv1/Coiv1Inicio.jsx';
import Granja from './coiv1/Granja.jsx';
import Experiencia from './coiv1/Experiencia.jsx';
import Captura from './coiv1/Captura.jsx';
import Arqueos from './coiv1/Arqueos.jsx';
import Brain from './coiv1/Brain.jsx';
import AdminV1 from './coiv1/AdminV1.jsx';
import { VISTAS_MODULOS } from '../modulos/vistas.jsx';
import { crearEnConstruccion } from './construccion/EnConstruccion.jsx';
import { PENDIENTES } from '../lib/estados.js';

const VIEWS = {
  inicio: Inicio,
  analistas: Analistas,
  analista: Analista,
  procesos: Procesos,
  clientes: Clientes,
  cliente: Cliente,
  catalogo: Catalogo,
  bitacora: Bitacora,
  pqr: Pqr,
  traza: Traza,
  implementacion: Implementacion,
  coiv1: Coiv1Inicio,
  granja: Granja,
  experiencia: Experiencia,
  captura: Captura,
  arqueos: Arqueos,
  brain: Brain,
  adminv1: AdminV1,
};
// Módulos de los analistas (npm run modulos:sync). El importador impide ids repetidos; aquí no se pisan vistas propias.
for (const [id, vista] of Object.entries(VISTAS_MODULOS)) {
  if (VIEWS[id]) console.error('[módulos] el id ' + id + ' choca con una vista del portal; se omite.');
  else VIEWS[id] = vista;
}
// Opciones del plan aún sin módulo instalado: vista «En construcción» (sin datos simulados).
for (const clave of Object.keys(PENDIENTES)) if (!VIEWS[clave]) VIEWS[clave] = crearEnConstruccion(clave);
export default VIEWS;
