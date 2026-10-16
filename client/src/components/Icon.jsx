import { PATHS } from './iconPaths.js';

/** Icono de línea. `name` es una clave de PATHS; las rutas son constantes internas. */
export default function Icon({ name, className = '', style }) {
  return (
    <svg className={'ic ' + className} viewBox="0 0 24 24" aria-hidden="true" style={style}
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}
