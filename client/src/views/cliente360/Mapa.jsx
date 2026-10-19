// Mapa de oficinas de Colombia (reutiliza el GeoMap de la Granja de usuarios).
import { useMemo } from 'react';
import GeoMap from '../coiv1/portal/GeoMap.jsx';
import '../coiv1/portal/portal.css';
import { titulo } from './shared.jsx';

/**
 * oficinas = [{ oficina, lat, lon, municipio, ... }]
 * colorDe(o) → color; leyenda = [[texto, color, n]]
 */
export default function Mapa({ oficinas, colorDe, leyenda, sel, onPick, fit = true, label = 'Mapa de oficinas', r = 3.2 }) {
  const points = useMemo(() => oficinas.filter((o) => o.lat !== null && o.lon !== null).map((o, i) => ({
    key: o.oficina + i, lat: o.lat, lon: o.lon, color: colorDe ? colorDe(o) : '#242A54', r: o.oficina === sel ? r + 2 : r,
    ring: o.oficina === sel, dim: !!sel && o.oficina !== sel ? false : false,
    title: titulo(o.oficina) + (o.municipio ? ' · ' + titulo(o.municipio) : ''), o
  })), [oficinas, colorDe, sel, r]);
  const s = sel ? oficinas.find((o) => o.oficina === sel && o.lat !== null) : null;
  const marks = s ? [{ key: 'sel', lat: s.lat, lon: s.lon, label: titulo(s.municipio || s.oficina), kind: 'pick' }] : [];
  return (
    <div className="c360-map">
      <GeoMap points={points} marks={marks} legend={leyenda} label={label} fit={fit && points.length > 0} onPick={onPick ? (p) => onPick(p.o.oficina) : undefined} />
      {!points.length && <div className="c360-map-empty">Sin coordenadas registradas en el Directorio</div>}
    </div>
  );
}
