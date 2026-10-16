import { useApp } from '../context/AppContext.jsx';

// Modo Comité: presentación ejecutiva a pantalla completa (fuera del Shell).
export default function Junta() {
  const { go } = useApp();
  return <div style={{ padding: 40 }}><button className="btn btn-o" onClick={() => go('inicio')}>Salir</button></div>;
}
