// Directorio de la Granja (obtenerDirectorioUsuarios): explorador por regional, zona, cliente y oficina.
import { useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { fmt, norm } from '../../../../lib/format.js';
import { Panel, Avatar, toneOf, Empty } from '../kit.jsx';
import GeoMap from '../GeoMap.jsx';
import { COL, coord } from '../granjaLogic.js';

export const REG_COLORS = ['#242A54', '#048C38', '#21BBEA', '#6C74A8', '#C99A00', '#1A8FB5'];
const up = (v) => String(v ?? '').trim().toUpperCase();
const esBackup = (f) => up(f[COL.BACKUP]) === 'SI';

export default function Directorio({ lista }) {
  const [q, setQ] = useState('');
  const [reg, setReg] = useState('');
  const [zona, setZona] = useState('');
  const [cli, setCli] = useState('');
  const [ofi, setOfi] = useState('');
  const [soloB, setSoloB] = useState(false);
  const [limite, setLimite] = useState(40);

  const personas = useMemo(() => lista.filter((f) => String(f[COL.NOMBRE] || '').trim()), [lista]);
  const regionales = useMemo(() => [...new Set(personas.map((f) => f[COL.REGIONAL]).filter(Boolean))].sort(), [personas]);
  const color = useMemo(() => Object.fromEntries(regionales.map((r, i) => [r, REG_COLORS[i % REG_COLORS.length]])), [regionales]);
  const zonas = useMemo(() => [...new Set(personas.filter((f) => !reg || f[COL.REGIONAL] === reg).map((f) => f[COL.ZONA]).filter(Boolean))].sort(), [personas, reg]);
  const clientes = useMemo(() => [...new Set(personas.map((f) => f[COL.CLIENTE]).filter(Boolean))].sort(), [personas]);

  const filtrados = useMemo(() => {
    const t = norm(q.trim());
    return personas.filter((f) => (!reg || f[COL.REGIONAL] === reg) && (!zona || f[COL.ZONA] === zona) && (!cli || f[COL.CLIENTE] === cli)
      && (!ofi || f[COL.OFICINA] === ofi) && (!soloB || esBackup(f))
      && (!t || norm(f[COL.NOMBRE]).includes(t) || norm(f[COL.OFICINA]).includes(t) || norm(f[COL.MUNICIPIO]).includes(t) || String(f[COL.CEDULA]).includes(q.trim()) || String(f[COL.PTR]) === q.trim()));
  }, [personas, q, reg, zona, cli, ofi, soloB]);

  // Agrupación por oficina (un punto por sede) y por zona.
  const sedes = useMemo(() => {
    const m = new Map();
    filtrados.forEach((f) => {
      const k = f[COL.OFICINA];
      const s = m.get(k) || { key: k, oficina: k, lat: coord(f[COL.LAT]), lon: coord(f[COL.LON]), reg: f[COL.REGIONAL], muni: f[COL.MUNICIPIO], n: 0, b: 0 };
      s.n++; if (esBackup(f)) s.b++;
      m.set(k, s);
    });
    return [...m.values()];
  }, [filtrados]);
  const porZona = useMemo(() => {
    const m = new Map();
    filtrados.forEach((f) => {
      const k = f[COL.ZONA] || 'Sin zona';
      const z = m.get(k) || { zona: k, reg: f[COL.REGIONAL], n: 0, b: 0, of: new Set() };
      z.n++; if (esBackup(f)) z.b++; z.of.add(f[COL.OFICINA]);
      m.set(k, z);
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [filtrados]);
  const maxZ = Math.max(1, ...porZona.map((z) => z.n));
  const totalB = filtrados.filter(esBackup).length;

  const limpiar = () => { setQ(''); setReg(''); setZona(''); setCli(''); setOfi(''); setSoloB(false); setLimite(40); };
  const hayFiltro = q || reg || zona || cli || ofi || soloB;

  return (
    <div className="v1p-dir">
      <div className="card v1p-filters">
        <div className="v1p-search grow"><Icon name="search" /><input className="inp" placeholder="Nombre, cédula, oficina, municipio o código PTR" value={q} onChange={(e) => { setQ(e.target.value); setLimite(40); }} /></div>
        <select className="inp" aria-label="Regional" value={reg} onChange={(e) => { setReg(e.target.value); setZona(''); }}><option value="">Todas las regionales</option>{regionales.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="inp" aria-label="Zona" value={zona} onChange={(e) => setZona(e.target.value)}><option value="">Todas las zonas</option>{zonas.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="inp" aria-label="Cliente" value={cli} onChange={(e) => setCli(e.target.value)}><option value="">Todos los clientes</option>{clientes.map((r) => <option key={r}>{r}</option>)}</select>
        <button type="button" className={'v1p-chip-t' + (soloB ? ' on' : '')} onClick={() => setSoloB((v) => !v)}><Icon name="usercheck" />Solo backups</button>
        {hayFiltro && <button type="button" className="btn btn-g btn-sm" onClick={limpiar}><Icon name="x" />Limpiar</button>}
      </div>
      {ofi && <div className="v1p-filter-tag"><Icon name="pin" />Oficina: <b>{ofi}</b><button type="button" aria-label="Quitar filtro de oficina" onClick={() => setOfi('')}><Icon name="x" /></button></div>}

      <div className="v1p-dir-grid">
        <Panel icon="map" title="Mapa de la granja" sub={`${fmt(sedes.length)} sedes · ${fmt(filtrados.length)} personas · ${fmt(totalB)} backups`} className="v1p-dir-map">
          <GeoMap label="Personas por sede" onPick={(p) => setOfi(p.key)}
            points={sedes.map((s) => ({ key: s.key, lat: s.lat, lon: s.lon, color: color[s.reg] || '#646B80', r: Math.min(7, 2.4 + Math.sqrt(s.n) * 0.9), ring: s.b > 0, title: `${s.oficina} · ${s.muni || ''} · ${s.n} personas${s.b ? ' · ' + s.b + ' backup' : ''}` }))}
            legend={regionales.filter((r) => r !== 'ADMINISTRACION').map((r) => [r, color[r]]).concat([['Con backup', '#F6CF46']])} />
        </Panel>
        <Panel icon="layers" title="Agrupación por zona" sub="Personas y backups disponibles. Pulse una zona para filtrar." className="v1p-dir-zonas" flush>
          {!porZona.length ? <Empty icon="search" title="Sin resultados" /> : (
            <ul className="v1p-zonas">
              {porZona.map((z) => (
                <li key={z.zona}>
                  <button type="button" className={zona === z.zona ? 'on' : ''} onClick={() => { if (zona === z.zona) setZona(''); else { setZona(z.zona); if (z.reg && !reg) setReg(z.reg); } }}>
                    <i style={{ background: color[z.reg] || '#646B80' }} />
                    <span className="v1p-zona-n"><b className="ellip">{z.zona}</b><small className="ellip">{z.reg} · {fmt(z.of.size)} sedes</small></span>
                    <span className="v1p-zona-bar"><i style={{ width: (z.n / maxZ) * 100 + '%', background: color[z.reg] || '#646B80' }} /></span>
                    <b className="num">{fmt(z.n)}</b>
                    <span className={'v1p-zona-b num' + (z.b ? '' : ' none')} title="Backups disponibles">{z.b}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel icon="users" title="Personas" sub={`${fmt(filtrados.length)} resultados`} flush className="mt">
        {!filtrados.length ? <Empty icon="search" title="Sin coincidencias">Ajuste la búsqueda o los filtros.</Empty> : (
          <div className="scroll-x">
            <table className="t v1p-table">
              <thead><tr><th>Persona</th><th>Oficina</th><th>Zona · Regional</th><th>Cliente</th><th className="c">Backup</th></tr></thead>
              <tbody>
                {filtrados.slice(0, limite).map((f, i) => (
                  <tr key={i}>
                    <td data-label="Persona"><div className="v1p-who"><Avatar name={f[COL.NOMBRE]} tone={toneOf(f[COL.NOMBRE])} size="sm" /><div><div className="cell-main">{f[COL.NOMBRE]}</div><div className="cell-sub">C.C. {f[COL.CEDULA]}</div></div></div></td>
                    <td data-label="Oficina"><div className="cell-main">{f[COL.OFICINA]}</div><div className="cell-sub">PTR {f[COL.PTR]} · {f[COL.MUNICIPIO] || 'Sin municipio'}</div></td>
                    <td data-label="Zona"><div className="cell-main">{f[COL.ZONA]}</div><div className="cell-sub">{f[COL.REGIONAL]}</div></td>
                    <td data-label="Cliente">{f[COL.CLIENTE] ? <span className="chip">{f[COL.CLIENTE]}</span> : '—'}</td>
                    <td data-label="Backup" className="c">{esBackup(f) ? <span className="badge b-ok">Disponible</span> : <span className="muted small">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtrados.length > limite && <div className="v1p-more-wrap"><button type="button" className="btn btn-g v1p-more" onClick={() => setLimite((l) => l + 60)}>Ver más ({fmt(filtrados.length - limite)})<Icon name="down" /></button></div>}
      </Panel>
    </div>
  );
}

