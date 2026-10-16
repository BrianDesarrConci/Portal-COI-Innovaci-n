// Registro de vistas: la ruta /:vista/:sub muestra el componente correspondiente.
import Inicio from './Inicio.jsx';
import Analistas from './Analistas.jsx';
import Analista from './Analista.jsx';
import Procesos from './Procesos.jsx';
import Clientes from './Clientes.jsx';
import Cliente from './Cliente.jsx';
import Catalogo from './Catalogo.jsx';
import Bitacora from './Bitacora.jsx';
import Validacion from './Validacion.jsx';
import Novedades from './Novedades.jsx';
import Pqr from './Pqr.jsx';
import Alertas from './Alertas.jsx';
import Fincomercio from './Fincomercio.jsx';
import Oficinas from './Oficinas.jsx';
import Reporteria from './Reporteria.jsx';
import Facturacion from './Facturacion.jsx';
import Ptr from './Ptr.jsx';
import Malas from './Malas.jsx';
import Papeleria from './Papeleria.jsx';
import Usuarios from './Usuarios.jsx';
import Cheques from './Cheques.jsx';
import Agrario from './Agrario.jsx';
import Ingresos from './Ingresos.jsx';
import Traza from './Traza.jsx';
import Implementacion from './Implementacion.jsx';

const VIEWS = {
  inicio: Inicio,
  analistas: Analistas,
  analista: Analista,
  procesos: Procesos,
  clientes: Clientes,
  cliente: Cliente,
  catalogo: Catalogo,
  bitacora: Bitacora,
  validacion: Validacion,
  novedades: Novedades,
  pqr: Pqr,
  alertas: Alertas,
  fincomercio: Fincomercio,
  oficinas: Oficinas,
  reporteria: Reporteria,
  facturacion: Facturacion,
  ptr: Ptr,
  malas: Malas,
  papeleria: Papeleria,
  usuarios: Usuarios,
  cheques: Cheques,
  agrario: Agrario,
  ingresos: Ingresos,
  traza: Traza,
  implementacion: Implementacion,
};
export default VIEWS;
