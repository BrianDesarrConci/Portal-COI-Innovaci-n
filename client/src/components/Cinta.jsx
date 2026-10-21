import { EN_DESARROLLO } from '../lib/estados.js';

const TEXTO = { construccion: 'En construcción', desarrollo: 'En desarrollo' };

/** Cinta de esquina de la vista: indica que la opción aún no está terminada. */
export default function Cinta({ estado, clave }) {
  if (!TEXTO[estado]) return null;
  const d = estado === 'desarrollo' && EN_DESARROLLO[clave];
  return (
    <div className={'cinta cinta-' + estado} role="note" aria-label={TEXTO[estado]} title={d && d.analista ? 'Responsable: ' + d.analista : undefined}>
      <span>{TEXTO[estado]}</span>
    </div>
  );
}

/** Marca de cinta para el menú lateral. */
export const CintaMenu = ({ estado }) => (TEXTO[estado] ? <span className={'nav-cinta ' + estado} title={TEXTO[estado]} aria-label={TEXTO[estado]} /> : null);
