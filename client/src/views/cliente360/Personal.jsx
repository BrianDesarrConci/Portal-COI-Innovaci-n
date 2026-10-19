// Cliente 360 · Personal: personas de la Granja de usuarios, backups, cobertura y novedades.
import { useMemo, useState } from 'react';
import { Cell, Table } from '../../components/ui.jsx';
import { fmt, shortDate } from '../../lib/format.js';
import { Barras, Empty, Search, Seg, Tile, titulo, usePaged, buscar } from './shared.jsx';

export default function Personal({ c, d }) {
  const p = d.personal;
  const [q, setQ] = useState('');
  const [f, setF] = useState('todas');
  const [zona, setZona] = useState(null);
  const rows = useMemo(() => p.personas.filter((x) => (f === 'todas' || (f === 'backup' ? x.backup : f === 'usuario' ? x.usuarioCliente : !!x.novedad))
    && (!zona || x.zona === zona) && buscar(q, x.nombre, x.oficina, x.zona, x.municipio)), [p, q, f, zona]);
  const [vis, more] = usePaged(rows, 25);
  const ofis = d.oficinas.length || 1;
  const cobertura = Math.round(((d.oficinas.length - p.sinPersonal.length) / ofis) * 100);
  const abiertas = d.novedades.filter((n) => n.abierta);
  const filtros = [['todas', 'Todas'], ['backup', 'Backup']].concat(p.conUsuario ? [['usuario', 'Con usuario ' + c.nombre]] : []).concat(p.personas.some((x) => x.novedad) ? [['nov', 'Con observación']] : []);

  if (!p.total) {
    return <section className="card c360-card"><Empty icon="users" title="Sin personas registradas">La Granja de usuarios no tiene personas con cliente {c.nombre}.</Empty></section>;
  }
  return (
    <div className="c360-stack">
      <div className="c360-tiles">
        <Tile label="Personas" value={fmt(p.total)} icon="users" sub={fmt(p.total / ofis, 1) + ' por oficina en promedio'} />
        <Tile label="Backup disponibles" value={fmt(p.backups)} icon="shield" tone="green" sub={fmt(p.total ? Math.round((p.backups / p.total) * 100) : 0) + ' % del personal'} onClick={() => setF('backup')} />
        {p.conUsuario ? <Tile label={'Con usuario ' + c.nombre} value={fmt(p.conUsuario)} icon="usercheck" tone="cyan" sub="Credencial en el sistema del cliente" onClick={() => setF('usuario')} />
          : <Tile label="Zonas con personal" value={fmt(p.porZona.length)} icon="pin" tone="cyan" sub={fmt(p.porRegional.length) + ' regionales'} />}
        <Tile label="Cobertura de oficinas" value={fmt(cobertura)} unit="%" icon="building" tone={p.sinPersonal.length ? 'gold' : 'navy'} sub={p.sinPersonal.length ? fmt(p.sinPersonal.length) + ' oficinas sin personal registrado' : 'Todas las oficinas tienen personal'} />
      </div>

      <div className="c360-grid-main">
        <section className="card c360-card">
          <header className="c360-ch c360-ch-tools">
            <div><h3>Personal en la Granja de usuarios</h3><p>{fmt(rows.length)} de {fmt(p.total)} personas{zona ? ' · zona ' + titulo(zona) : ''}</p></div>
            <div className="c360-tools">
              <Seg label="Filtro de personal" value={f} onChange={setF} items={filtros} />
              <Search value={q} onChange={setQ} placeholder="Buscar persona u oficina…" />
            </div>
          </header>
          {rows.length ? (
            <div className="c360-cb flush">
              <Table headers={['Persona', 'Oficina', 'Zona', 'Rol de apoyo', 'Observación']}
                rows={vis.map((x, i) => ({ key: x.nombre + i, cells: [
                  <Cell main={titulo(x.nombre)} sub={'C.C. ' + (x.cedula || '—')} />,
                  <Cell main={titulo(x.oficina)} sub={titulo(x.municipio)} />,
                  <span className="small">{titulo(x.zona)}</span>,
                  <span className="c360-tags">{x.backup ? <span className="badge b-ok">Backup</span> : <span className="badge b-mute">Titular</span>}{x.usuarioCliente && <span className="badge b-info">Usuario {c.nombre}</span>}{x.negociosBackup.length ? <small className="muted">{x.negociosBackup.map(titulo).join(', ')}</small> : null}</span>,
                  <span className="small muted">{x.novedad ? titulo(x.novedad) : '—'}</span>
                ] }))} />
              {more}
            </div>
          ) : <Empty icon="search" title="Sin coincidencias" />}
        </section>
        <div className="c360-stack">
          <section className="card c360-card">
            <header className="c360-ch"><div><h3>Por zona</h3><p>Seleccione una zona para filtrar</p></div></header>
            <div className="c360-cb"><Barras rows={p.porZona} total={p.total} max={8} color="var(--cyan)" onPick={setZona} active={zona} /></div>
          </section>
          {p.sinPersonal.length > 0 && (
            <section className="card c360-card">
              <header className="c360-ch"><div><h3>Oficinas sin personal</h3><p>No tienen personas en la Granja</p></div></header>
              <div className="c360-cb c360-chips">{p.sinPersonal.map((o) => <span key={o} className="chip">{titulo(o)}</span>)}</div>
            </section>
          )}
        </div>
      </div>

      <section className="card c360-card">
        <header className="c360-ch"><div><h3>Novedades de personal</h3><p>Bajas reportadas en la Granja para oficinas de {c.nombre} · {fmt(abiertas.length)} abiertas de {fmt(d.novedades.length)}</p></div></header>
        {d.novedades.length ? (
          <div className="c360-cb flush">
            <Table headers={['Persona', 'Oficina', 'Motivo', 'Inicio', 'Backup asignado', 'Estado']}
              rows={d.novedades.map((n) => ({ key: n.id, cells: [
                <Cell main={titulo(n.persona)} sub={'Reportó ' + titulo(n.reportadoPor)} />,
                <span className="small">{titulo(n.oficina)}</span>,
                <span className="small">{n.descripcion}</span>,
                <span className="small nowrap">{n.inicio ? shortDate(n.inicio) : '—'}{n.dias ? ' · ' + n.dias + ' d' : ''}</span>,
                <span className="small">{n.backup ? titulo(n.backup) : <span className="muted">Sin asignar</span>}</span>,
                <span className={'badge ' + (n.abierta ? 'b-warn' : 'b-ok')}>{titulo(n.estado)}</span>
              ] }))} />
          </div>
        ) : <Empty icon="check" title="Sin novedades registradas">No hay bajas reportadas para las oficinas del cliente.</Empty>}
      </section>
    </div>
  );
}
