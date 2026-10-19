// Cliente 360 · Arqueos: cumplimiento real del mes (Control de Arqueos) y su tendencia.
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Cell, Table } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt } from '../../lib/format.js';
import { Empty, mesLargo, money, moneyCorto, Ring, Search, Seg, SerieMeses, Tile, titulo, usePaged, buscar } from './shared.jsx';

const FMT = { 'FOR-GOR-020-09': 'Efectivo', 'FOR-GOR-048-01': 'Cheques', 'FOR-GOR-099-02': 'ATM' };

export default function ArqueosC({ c, d }) {
  const { go } = useApp();
  const t = d.arqueos.totalesMes, k = d.kpis;
  const [vista, setVista] = useState('pendientes');
  const [q, setQ] = useState('');
  const lista = vista === 'pendientes' ? d.arqueos.pendientes : vista === 'diferencias' ? d.arqueos.diferenciasMes : d.arqueos.listaMes;
  const rows = useMemo(() => lista.filter((x) => buscar(q, x.oficina, x.zona, x.lider, x.novedad)), [lista, q]);
  const [vis, more] = usePaged(rows, 20);
  const conDatos = d.arqueos.serie.filter((s) => s.conDatos);

  if (!t.oficinas) return <section className="card c360-card"><Empty icon="filecheck" title="Sin oficinas para arqueo">El cliente no tiene oficinas en el Directorio Nacional.</Empty></section>;
  return (
    <div className="c360-stack">
      <section className="card c360-arq-hero">
        <Ring v={t.pctCumplimiento} size={118} stroke={11} light />
        <div className="grow">
          <div className="c360-kicker light">Control de Arqueos · {mesLargo(d.mes)}</div>
          <h3>{fmt(t.cumplen)} de {fmt(t.oficinas)} oficinas cumplen el arqueo del mes</h3>
          <p>{fmt(t.alDia)} al día · {fmt(t.parciales)} parciales · {fmt(t.sinArqueo)} sin arqueo · {fmt(t.extemporaneas)} con arqueos extemporáneos. Mes anterior: {k.pctMesAnterior === null ? '—' : fmt(k.pctMesAnterior) + ' %'}.</p>
        </div>
        <button type="button" className="btn c360-btn-light" onClick={() => go('arqueos')}><Icon name="filecheck" />Abrir Control de Arqueos</button>
      </section>
      <div className="c360-tiles">
        <Tile label="Arqueos registrados" value={fmt(t.arqueos)} icon="filecheck" sub={fmt(t.visitas) + ' visitas · ' + fmt(k.arqueosMesAnterior) + ' en ' + mesLargo(d.mesAnterior)} />
        <Tile label="Oficinas pendientes" value={fmt(t.oficinas - t.cumplen)} icon="clock" tone="gold" sub="Sin el arqueo exigido del mes" onClick={() => setVista('pendientes')} />
        <Tile label="Faltantes" value={fmt(k.faltantesMes)} icon="alert" tone={k.faltantesMes ? 'gold' : 'navy'} sub={k.faltantesMes ? moneyCorto(k.montoFaltanteMes) + ' en diferencias' : 'Sin faltantes en el mes'} onClick={() => setVista('diferencias')} />
        <Tile label="Sobrantes" value={fmt(k.sobrantesMes)} icon="wallet" tone="cyan" sub={k.sobrantesMes ? moneyCorto(k.montoSobranteMes) + ' en diferencias' : 'Sin sobrantes en el mes'} onClick={() => setVista('diferencias')} />
      </div>
      <div className="c360-grid-main">
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Tendencia</h3><p>{conDatos.length < 3 ? 'El Control de Arqueos registra datos desde ' + (conDatos[0] ? mesLargo(conDatos[0].mes) : 'este mes') : 'Últimos seis meses'}</p></div></header>
          <div className="c360-cb"><SerieMeses serie={d.arqueos.serie} /></div>
        </section>
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Requisitos del mes</h3><p>Formatos exigidos por el Directorio</p></div></header>
          <div className="c360-cb c360-req">
            <div><span>Arqueo de oficina (efectivo)</span><b className="num">{fmt(t.cumplen)} / {fmt(t.oficinas)}</b></div>
            <div><span>Cajeros ATM</span><b className="num">{t.atmTotal ? fmt(t.atmHechos) + ' / ' + fmt(t.atmTotal) : 'No aplica'}</b></div>
            <div><span>Oficinas al día (sin extemporáneos)</span><b className="num">{fmt(t.pctAlDia)} %</b></div>
            <div><span>Diferencias del mes</span><b className="num">{fmt(t.faltantes + t.sobrantes)}</b></div>
            <p className="small muted">Mismas reglas del módulo Control de Arqueos: el arqueo de efectivo consume la meta, cada cajero ATM cuenta una vez al mes y los extemporáneos no cumplen.</p>
          </div>
        </section>
      </div>
      <section className="card c360-card">
        <header className="c360-ch c360-ch-tools">
          <div><h3>{vista === 'pendientes' ? 'Oficinas pendientes de arqueo' : vista === 'diferencias' ? 'Faltantes y sobrantes del mes' : 'Arqueos del mes'}</h3><p>{mesLargo(d.mes)} · {fmt(rows.length)} registros</p></div>
          <div className="c360-tools">
            <Seg label="Vista" value={vista} onChange={setVista} items={[['pendientes', 'Pendientes · ' + fmt(d.arqueos.pendientes.length)], ['diferencias', 'Diferencias · ' + fmt(d.arqueos.diferenciasMes.length)], ['todos', 'Arqueos · ' + fmt(d.arqueos.listaMes.length)]]} />
            <Search value={q} onChange={setQ} placeholder="Buscar oficina o líder…" />
          </div>
        </header>
        {!rows.length ? <Empty icon="check" title={vista === 'pendientes' ? 'Todas las oficinas cumplen' : 'Sin registros'}>{vista === 'diferencias' ? 'No hay faltantes ni sobrantes en el mes.' : ''}</Empty> : (
          <div className="c360-cb flush">
            {vista === 'pendientes' ? (
              <Table headers={['Oficina', 'Regional y zona', 'Líder', 'Falta', 'Estado']}
                rows={vis.map((o) => ({ key: o.oficina, cells: [
                  <Cell main={titulo(o.oficina)} />, <Cell main={titulo(o.regional)} sub={titulo(o.zona)} />, <span className="small">{titulo(o.lider)}</span>,
                  <span className="c360-tags">{o.pendientes.map((p) => <span key={p} className="chip">{p}</span>)}</span>,
                  <span className={'badge ' + (o.estado === 'PARCIAL' ? 'b-warn' : 'b-mute')}>{o.estado === 'PARCIAL' ? 'Parcial' : 'Sin arqueo'}</span>
                ] }))} />
            ) : (
              <Table headers={['Fecha', 'Oficina', 'Formato', 'Líder', 'Novedad', 'Diferencia']} align={['', '', '', '', '', 'r']}
                rows={vis.map((a) => ({ key: a.id, cells: [
                  <span className="num nowrap">{a.fecha}</span>,
                  <Cell main={titulo(a.oficina)} sub={[a.tipo, a.elemento].filter(Boolean).join(' · ')} />,
                  <span className="small">{FMT[a.formato] || a.formato}{a.extemporaneo ? <span className="badge b-warn c360-ml">Extemporáneo</span> : null}</span>,
                  <span className="small">{titulo(a.lider)}</span>,
                  <span className={'badge ' + (a.novedad === 'FALTANTE' ? 'b-bad' : a.novedad === 'SOBRANTE' ? 'b-info' : a.novedad === 'SIN NOVEDAD' ? 'b-ok' : 'b-mute')}>{titulo(a.novedad || 'Pendiente')}</span>,
                  <span className={'num strong ' + (a.diferencia < 0 ? 'down' : '')}>{a.diferencia === null ? '—' : money(a.diferencia)}</span>
                ] }))} />
            )}
            {more}
          </div>
        )}
      </section>
    </div>
  );
}
