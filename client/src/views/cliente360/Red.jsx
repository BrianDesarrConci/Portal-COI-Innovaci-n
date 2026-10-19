// Cliente 360 · Red de oficinas: mapa, distribución y directorio buscable (Directorio Nacional).
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Cell, Table } from '../../components/ui.jsx';
import { fmt, shortDate } from '../../lib/format.js';
import Mapa from './Mapa.jsx';
import { Barras, Empty, EstadoTag, Search, Seg, titulo, usePaged, buscar, mesLargo } from './shared.jsx';

const COLOR = (o) => (o.cumpleMes ? '#048C38' : o.estadoMes === 'PARCIAL' ? '#21BBEA' : '#242A54');
const DIMS = [['regional', 'Regional'], ['zona', 'Zona'], ['departamento', 'Departamento'], ['estructura', 'Estructura'], ['medioPago', 'Medio de pago']];
const valorDim = (o, dim) => (dim === 'medioPago' ? o.medioPago || 'SIN PARAMETRIZAR' : o[dim] || 'SIN DATO');

const horario = (h) => [h.lv && 'L-V ' + h.lv, h.sab && 'Sáb ' + h.sab, h.dom && 'Dom ' + h.dom].filter(Boolean);

export default function Red({ c, d }) {
  const dedicadas = d.oficinas;
  const hab = d.red && d.red.puntos ? d.red.oficinas : [];
  const [modo, setModo] = useState(dedicadas.length ? 'dedicadas' : 'habilitadas');
  const tieneAmbas = dedicadas.length > 0 && hab.length > 0 && hab.length !== dedicadas.length;
  return (
    <div className="c360-stack">
      {tieneAmbas && (
        <div className="c360-toolbar">
          <Seg label="Tipo de red" value={modo} onChange={setModo} items={[['dedicadas', 'Oficinas dedicadas · ' + fmt(dedicadas.length)], ['habilitadas', 'Puntos habilitados · ' + fmt(hab.length)]]} />
          <span className="small muted">{modo === 'dedicadas' ? 'Oficinas cuyo cliente en el Directorio Nacional es ' + c.nombre + '.' : 'Oficinas de toda la red con código de ' + c.nombre + ' en el Directorio Nacional.'}</span>
        </div>
      )}
      {modo === 'dedicadas' && dedicadas.length ? <Dedicadas c={c} d={d} /> : hab.length ? <Habilitadas c={c} rows={hab} /> : <section className="card c360-card"><Empty icon="building" title="Sin oficinas registradas">El Directorio Nacional no registra oficinas para {c.nombre}.</Empty></section>}
    </div>
  );
}

function Dedicadas({ c, d }) {
  const [dim, setDim] = useState('regional');
  const [filtro, setFiltro] = useState(null); // [dim, valor]
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [estado, setEstado] = useState('todas');
  const dist = useMemo(() => {
    const m = {}; d.oficinas.forEach((o) => { const v = valorDim(o, dim); m[v] = (m[v] || 0) + 1; });
    return Object.keys(m).map((k) => ({ nombre: k, n: m[k] })).sort((a, b) => b.n - a.n);
  }, [d, dim]);
  const rows = useMemo(() => d.oficinas.filter((o) => (!filtro || valorDim(o, filtro[0]) === filtro[1])
    && (estado === 'todas' || (estado === 'cumple' ? o.cumpleMes : !o.cumpleMes))
    && buscar(q, o.oficina, o.municipio, o.departamento, o.zona, o.lider, o.ptr, o.direccion)), [d, filtro, q, estado]);
  const [vis, more] = usePaged(rows, 25);
  const so = sel ? d.oficinas.find((o) => o.oficina === sel) : null;
  const pick = (of) => setSel((s) => (s === of ? null : of));
  const nCumple = d.oficinas.filter((o) => o.cumpleMes).length, nParc = d.oficinas.filter((o) => o.estadoMes === 'PARCIAL').length;

  return (
    <>
      <div className="c360-red">
        <section className="card c360-card c360-red-map">
          <header className="c360-ch"><div><h3>Mapa de la red</h3><p>Color según el arqueo de {mesLargo(d.mes)}; seleccione un punto</p></div></header>
          <div className="c360-cb">
            <Mapa oficinas={rows} colorDe={COLOR} sel={sel} onPick={pick} label={'Oficinas de ' + c.nombre}
              leyenda={[['Cumple', '#048C38', nCumple], ['Parcial', '#21BBEA', nParc], ['Pendiente', '#242A54', d.oficinas.length - nCumple - nParc]]} />
          </div>
        </section>
        <div className="c360-red-side">
          {so ? <Detalle o={so} onClose={() => setSel(null)} mes={d.mes} /> : <Perfil d={d} />}
          <section className="card c360-card">
            <header className="c360-ch"><div><h3>Distribución</h3><p>Seleccione un grupo para filtrar el directorio</p></div></header>
            <div className="c360-cb">
              <div className="c360-dims">{DIMS.map((x) => <button type="button" key={x[0]} className={'c360-pill' + (dim === x[0] ? ' on' : '')} onClick={() => setDim(x[0])}>{x[1]}</button>)}</div>
              <Barras rows={dist} max={8} total={d.oficinas.length} active={filtro && filtro[0] === dim ? filtro[1] : null} onPick={(v) => setFiltro(v ? [dim, v] : null)} />
            </div>
          </section>
        </div>
      </div>

      <section className="card c360-card">
        <header className="c360-ch c360-ch-tools">
          <div><h3>Directorio de oficinas</h3><p>{fmt(rows.length)} de {fmt(d.oficinas.length)} oficinas · Directorio Nacional</p></div>
          <div className="c360-tools">
            {filtro && <button type="button" className="c360-filter" onClick={() => setFiltro(null)}>{titulo(filtro[1])}<Icon name="x" /></button>}
            <Seg label="Estado del arqueo" value={estado} onChange={setEstado} items={[['todas', 'Todas'], ['cumple', 'Cumplen'], ['pend', 'Pendientes']]} />
            <Search value={q} onChange={setQ} placeholder="Buscar oficina, municipio, líder…" />
          </div>
        </header>
        {rows.length ? (
          <div className="c360-cb flush scroll-x c360-dirtable">
            <Table headers={['Oficina', 'Ubicación', 'Regional y zona', 'Horario', 'Líder de excelencia', 'Personas', 'Arqueo del mes']} align={['', '', '', '', '', 'r', '']}
              rows={vis.map((o) => ({
                key: o.oficina, onClick: () => pick(o.oficina), cells: [
                  <Cell main={<span className={sel === o.oficina ? 'c360-selname' : ''}>{titulo(o.oficina)}</span>} sub={['PTR ' + (o.ptr || '—'), o.estructura && o.estructura !== '#N/A' ? titulo(o.estructura) : null, o.exigeATM ? 'ATM' : null, o.exigeCheques ? 'Cheques' : null].filter(Boolean).join(' · ')} />,
                  <Cell main={titulo(o.municipio) || '—'} sub={titulo(o.departamento)} />,
                  <Cell main={titulo(o.regional)} sub={titulo(o.zona)} />,
                  <span className="small c360-hor">{horario(o.horario).map((h) => <span key={h}>{h}</span>)}{!horario(o.horario).length && <span className="muted">Sin horario</span>}</span>,
                  <span className="small">{titulo(o.lider) || '—'}</span>,
                  <span className="num strong">{fmt(o.personas)}{o.backups ? <small className="muted"> · {o.backups} bk</small> : null}</span>,
                  <EstadoTag e={o.estadoMes} />
                ]
              }))} />
            {more}
          </div>
        ) : <Empty icon="search" title="Sin coincidencias">Ajuste la búsqueda o quite el filtro.</Empty>}
      </section>
    </>
  );
}

function Perfil({ d }) {
  const o = d.oficinas, n = o.length || 1;
  const cnt = (f) => o.filter(f).length;
  const items = [
    ['Atienden sábado', cnt((x) => x.horario.sab && !/N\/A|CERRAD/i.test(x.horario.sab))],
    ['Atienden domingo', cnt((x) => x.horario.dom && !/N\/A|CERRAD/i.test(x.horario.dom))],
    ['Con cajero ATM', cnt((x) => x.exigeATM)],
    ['Exigen arqueo de cheques', cnt((x) => x.exigeCheques)],
    ['Red Reval', cnt((x) => /REVAL/i.test(x.red))],
    ['Red Multipagas', cnt((x) => /MULTIPAGAS/i.test(x.red))]
  ];
  return (
    <section className="card c360-card">
      <header className="c360-ch"><div><h3>Perfil de la red</h3><p>Seleccione una oficina en el mapa o en el directorio para ver su ficha</p></div></header>
      <div className="c360-cb c360-perfil">
        {items.map((it) => <div key={it[0]}><b className="num">{fmt(it[1])}</b><span>{it[0]}</span><i style={{ width: (it[1] / n) * 100 + '%' }} /></div>)}
      </div>
    </section>
  );
}

function Detalle({ o, onClose, mes }) {
  const filas = [
    ['Dirección', [o.direccion && titulo(o.direccion), o.barrio && 'Barrio ' + titulo(o.barrio)].filter(Boolean).join(' · ') || '—'],
    ['Municipio', titulo(o.municipio) + (o.departamento ? ', ' + titulo(o.departamento) : '')],
    ['Horario', horario(o.horario).join(' · ') || '—'],
    ['Regional', titulo(o.regional) + (o.gerente ? ' · ' + titulo(o.gerente) : '')],
    ['Zona y líder', titulo(o.zona) + (o.lider ? ' · ' + titulo(o.lider) : '')],
    ['Medio de pago', o.medioPago ? titulo(o.medioPago) : 'Sin parametrizar'],
    ['ATM', o.atm || 'No tiene'],
    ['Apertura', o.apertura ? shortDate(o.apertura) : '—'],
    ['Personal', fmt(o.personas) + ' personas · ' + fmt(o.backups) + ' backup'],
    ['Último arqueo', o.fechaArqueo ? o.fechaArqueo + (o.liderArqueo ? ' · ' + titulo(o.liderArqueo) : '') : 'Sin arqueo en ' + mesLargo(mes)]
  ];
  return (
    <section className="card c360-card c360-detail view-enter">
      <header className="c360-ch"><div><h3>{titulo(o.oficina)}</h3><p>PTR {o.ptr || '—'}{o.red ? ' · ' + titulo(o.red) : ''}{o.negocio ? ' · ' + o.negocio : ''}</p></div>
        <button type="button" className="btn btn-g btn-sm btn-ic" onClick={onClose} aria-label="Cerrar detalle"><Icon name="x" /></button></header>
      <div className="c360-cb">
        <div className="c360-detail-st"><EstadoTag e={o.estadoMes} />{o.pendientes && o.pendientes.length ? <span className="small muted">Pendiente: {o.pendientes.join(', ')}</span> : null}</div>
        <dl className="c360-dl">{filas.map((f) => <div key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl>
      </div>
    </section>
  );
}

function Habilitadas({ c, rows: all }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const rows = useMemo(() => all.filter((o) => buscar(q, o.oficina, o.municipio, o.departamento, o.zona, o.codigo)), [all, q]);
  const [vis, more] = usePaged(rows, 25);
  const porDep = useMemo(() => { const m = {}; all.forEach((o) => { m[o.departamento || 'SIN DATO'] = (m[o.departamento || 'SIN DATO'] || 0) + 1; }); return Object.keys(m).map((k) => ({ nombre: k, n: m[k] })).sort((a, b) => b.n - a.n); }, [all]);
  return (
    <>
      <div className="c360-red">
        <section className="card c360-card c360-red-map">
          <header className="c360-ch"><div><h3>Puntos habilitados</h3><p>Oficinas con código de {c.nombre} en el Directorio</p></div></header>
          <div className="c360-cb"><Mapa oficinas={rows} colorDe={(o) => (o.cliente === 'MULTIVAL' ? '#048C38' : '#21BBEA')} sel={sel} onPick={(x) => setSel((s) => (s === x ? null : x))} label={'Puntos de ' + c.nombre}
            leyenda={[['Red propia', '#048C38', all.filter((o) => o.cliente === 'MULTIVAL').length], ['Oficina de cliente', '#21BBEA', all.filter((o) => o.cliente !== 'MULTIVAL').length]]} /></div>
        </section>
        <div className="c360-red-side">
          <section className="card c360-card">
            <header className="c360-ch"><div><h3>Por departamento</h3><p>{fmt(all.length)} puntos</p></div></header>
            <div className="c360-cb"><Barras rows={porDep} max={10} total={all.length} color="var(--green)" /></div>
          </section>
        </div>
      </div>
      <section className="card c360-card">
        <header className="c360-ch c360-ch-tools"><div><h3>Listado de puntos</h3><p>{fmt(rows.length)} de {fmt(all.length)}</p></div>
          <div className="c360-tools"><Search value={q} onChange={setQ} placeholder="Buscar punto, municipio, código…" /></div></header>
        {rows.length ? (
          <div className="c360-cb flush scroll-x c360-dirtable">
            <Table headers={['Oficina', 'Código', 'Ubicación', 'Regional y zona', 'Horario']}
              rows={vis.map((o) => ({ key: o.oficina, onClick: () => setSel(o.oficina), cells: [
                <Cell main={<span className={sel === o.oficina ? 'c360-selname' : ''}>{titulo(o.oficina)}</span>} sub={o.cliente === 'MULTIVAL' ? 'Red propia' : 'Oficina de ' + titulo(o.cliente)} />,
                <span className="num">{o.codigo}</span>,
                <Cell main={titulo(o.municipio) || '—'} sub={titulo(o.departamento)} />,
                <Cell main={titulo(o.regional)} sub={titulo(o.zona)} />,
                <span className="small c360-hor">{horario(o.horario).map((h) => <span key={h}>{h}</span>)}{o.cesantias && <span className="muted">{o.cesantias}</span>}</span>
              ] }))} />
            {more}
          </div>
        ) : <Empty icon="search" title="Sin coincidencias" />}
      </section>
    </>
  );
}
