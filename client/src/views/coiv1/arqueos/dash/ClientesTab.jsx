// Pestaña Por cliente / oficina ("Mis oficinas" para el líder): renderClientes / pintarClientes de V1.
import { useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { useMes, useRpc, mesNombre, n0, norm, sinTildes, heatNivel, C } from './lib.js';
import { Head, Tile, Panel, Estado, SortTable, Pills, Search, Chip } from './ui.jsx';
import { Ring, StackStrip } from './charts.jsx';

const EST_CHIP = {
  OK: ['ok', 'check', 'OK'], PENDIENTE: ['bad', 'x', 'Pendiente'], EXTEMPORANEO: ['warn', 'clock', 'Extemporáneo'],
  PARCIAL: ['warn', 'activity', 'Parcial'], 'N/A': ['mute', null, 'No aplica']
};
export function EstadoChip({ est, extra }) {
  const m = EST_CHIP[est] || EST_CHIP['N/A'];
  return <Chip tone={m[0]} icon={m[1]}>{m[2]}{extra ? ' · ' + extra : ''}</Chip>;
}
const GEN = { 'AL DIA': ['ok', 'Al día'], 'CUMPLE CON EXTEMPORANEO': ['warn', 'Cumple con extemporáneo'], PARCIAL: ['warn', 'Parcial'], 'SIN ARQUEO': ['bad', 'Sin arqueo'] };
const NIV = { ok: C.green, warn: '#E0B520', bad: C.red };

export function ClientesTab({ user }) {
  const { mes, meses, setMes } = useMes(user);
  const [cliente, setCliente] = useState('');
  const q = useRpc('obtenerDashboardClientes', [user.idUsuario, user.rol, mes, cliente]);
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerDashboardClientes">
        {(d) => <Clientes d={d} user={user} mes={mes} meses={meses} setMes={setMes} reload={q.reload} cliente={cliente} setCliente={setCliente} cargando={q.loading} />}
      </Estado>
    </div>
  );
}

function Clientes({ d, user, mes, meses, setMes, reload, cliente, setCliente, cargando }) {
  const t = d.totales, esLider = user.rol === 'Lider';
  const [f, setF] = useState('todas');
  const [busca, setBusca] = useState('');
  const ofis = d.oficinas || [];
  const conGestion = ofis.filter((o) => o.pendientesGestion > 0).length;

  const lista = useMemo(() => {
    let l = ofis;
    if (f === 'conArqueo') l = l.filter((o) => o.conArqueo);
    else if (f === 'pendientes') l = l.filter((o) => !o.cumple);
    else if (f === 'atm') l = l.filter((o) => o.exige.atm);
    else if (f === 'cheques') l = l.filter((o) => o.exige.cheques);
    else if (f === 'alDia') l = l.filter((o) => o.aTiempo);
    else if (f === 'gestion') l = l.filter((o) => o.pendientesGestion > 0);
    if (busca) { const b = sinTildes(busca); l = l.filter((o) => sinTildes([o.oficina, o.cliente, o.regional, o.zona, o.lider].join(' ')).includes(b)); }
    return l;
  }, [ofis, f, busca]);

  const generales = ['AL DIA', 'CUMPLE CON EXTEMPORANEO', 'PARCIAL', 'SIN ARQUEO'].map((k) => ({ k, value: ofis.filter((o) => o.estadoGeneral === k).length }));
  const genColor = { 'AL DIA': C.green, 'CUMPLE CON EXTEMPORANEO': '#5CC6A0', PARCIAL: '#E0B520', 'SIN ARQUEO': C.red };
  const clienteSel = d.clientes.find((x) => norm(x.cliente) === norm(d.cliente));

  const cols = [
    { k: 'oficina', h: 'Oficina', render: (o) => <div className="aqd-cell2 aqd-w-of"><b className="aqd-nav">{o.oficina}{o.pendientesGestion > 0 && <span className="aqd-bubble" title="Novedades pendientes de respuesta">{o.pendientesGestion}</span>}</b><small>{o.cliente}{o.propia ? ' · Propia' : ''}{o.usd ? ' · USD' : ''}</small></div> },
    { k: 'regional', h: esLider ? 'Regional / zona' : 'Regional / zona · líder', sort: (o) => o.regional + ' ' + o.zona, render: (o) => <div className="aqd-cell2 aqd-w-ub"><span>{o.regional} · <span className="muted">{o.zona}</span></span>{!esLider && <small>{o.lider}</small>}</div> },
    { k: 'formatos', h: 'Formatos exigidos en el mes', sort: (o) => o.pendientes.length, render: (o) => (
      <div className="aqd-fmts">
        {(o.exige.oficina || o.estadoOficina !== 'N/A') && <span><em>Efectivo</em><EstadoChip est={o.estadoOficina} extra={o.fechaOficina} /></span>}
        {(o.exige.cheques || o.estadoCheques !== 'N/A') && <span><em>Cheques Porvenir</em><EstadoChip est={o.estadoCheques} extra={o.fechaCheques} /></span>}
        {o.exige.atm && <span><em>ATM ×{o.atmTotal}</em><EstadoChip est={o.estadoATM} extra={o.atmHechos + '/' + o.atmTotal} /></span>}
      </div>) },
    { k: 'visitas', h: 'Visitas · oportunidad', render: (o) => (
      <div className="aqd-cell2"><span><b className="num">{o.visitas}</b>{o.arqueosValidos > 0 && <small className="muted"> · {o.arqueosValidos} válidos</small>}</span>
        {o.extemporaneos ? <Chip tone="warn" icon="clock">{o.extemporaneos} extemp.</Chip> : (o.conArqueo ? <Chip tone="ok" icon="check">A tiempo</Chip> : null)}</div>) },
    { k: 'estadoGeneral', h: 'Estado · pendiente', render: (o) => { const g = GEN[o.estadoGeneral] || ['mute', o.estadoGeneral]; return (
      <div className="aqd-cell2"><Chip tone={g[0]}>{g[1]}</Chip>
        {o.pendientes.length > 0 && <small className="aqd-neg">Falta: {o.pendientes.join(' + ')}</small>}
        {(o.faltantes || o.sobrantes) ? <small className={o.faltantes ? 'aqd-neg' : 'aqd-gold'}>{o.faltantes ? o.faltantes + ' faltante(s)' : ''}{o.faltantes && o.sobrantes ? ' · ' : ''}{o.sobrantes ? o.sobrantes + ' sobrante(s)' : ''}</small> : null}</div>); } }
  ];

  const clienteSelect = (
    <label className="aqd-sel">
      <Icon name="building" /><span className="aqd-vh">Cliente</span>
      <select value={d.cliente || ''} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente">
        <option value="">Todos los clientes</option>
        {d.clientes.map((x) => <option key={x.cliente} value={x.cliente}>{x.cliente} ({x.oficinas})</option>)}
      </select>
    </label>
  );

  return (
    <>
      <Head title={(esLider ? 'Mis oficinas' : 'Cumplimiento por cliente y oficina') + ' · ' + mesNombre(d.mes)}
        sub="Oficinas con arqueo ejecutado o pendiente, servicios ATM y cheques Porvenir, y cumplimiento a tiempo (ATM válido una vez al mes)."
        mes={mes} meses={meses} setMes={setMes} extra={clienteSelect} />

      <section className={'aqd-hero' + (cargando ? ' aqd-busy' : '')}>
        <div className="aqd-hero-main">
          <Ring pct={t.pctCumplimiento} color={C.cyan} size={168} label={`${t.pctCumplimiento}% de oficinas con todos los formatos`}>
            <b className="num"><CountUp value={t.pctCumplimiento + '%'} /></b><span>cumplen</span>
          </Ring>
          <div className="aqd-hero-id">
            <span className="aqd-hero-k">{d.cliente ? d.cliente : esLider ? 'Mis oficinas' : 'Todos los clientes'}</span>
            <div className="aqd-hero-big num"><CountUp value={n0(t.cumplen)} /><small> / {n0(t.oficinas)}</small></div>
            <p className="aqd-hero-sub">oficinas con todos los formatos exigidos registrados en el mes</p>
            <div className="aqd-hero-dist">
              <StackStrip label="Oficinas por estado" parts={generales.map((g) => ({ label: GEN[g.k][1], value: g.value, color: genColor[g.k] }))} />
              <div className="aqd-hero-lg">{generales.map((g) => <span key={g.k}><i style={{ background: genColor[g.k] }} />{GEN[g.k][1]} <b>{g.value}</b></span>)}</div>
            </div>
          </div>
        </div>
        <div className="aqd-hero-stats">
          <div className="aqd-hs"><span>Al día (a tiempo)</span><b className="num"><CountUp value={t.pctAlDia + '%'} /></b><small>{t.alDia} de {t.oficinas} · {t.extemporaneas} con extemporáneos</small></div>
          <div className="aqd-hs"><span>ATM con arqueo del mes</span><b className="num"><CountUp value={t.pctATM + '%'} /></b><small>{t.atmHechos}/{t.atmTotal} cajeros · válido 1 vez al mes</small></div>
          <div className="aqd-hs"><span>Cheques Porvenir</span><b className="num"><CountUp value={t.pctCheques + '%'} /></b><small>{t.chequesOK} de {t.conCheques} oficinas con arqueo</small></div>
          <div className="aqd-hs"><span>Visitas del mes</span><b className="num"><CountUp value={n0(t.visitas)} /></b><small>{t.faltantes} faltantes · {t.sobrantes} sobrantes</small></div>
        </div>
      </section>

      {!esLider && d.clientes.length > 1 && (
        <div className="aqd-clients" role="list" aria-label="Clientes">
          <button type="button" role="listitem" className={'aqd-ccard' + (!d.cliente ? ' on' : '')} onClick={() => setCliente('')}>
            <span className="aqd-ccard-n">Todos los clientes</span>
            <b className="num">{d.clientes.reduce((a, x) => a + x.oficinas, 0)}</b><small>oficinas</small>
          </button>
          {d.clientes.map((x) => {
            const niv = heatNivel(x.pct);
            return (
              <button type="button" role="listitem" key={x.cliente} className={'aqd-ccard' + (clienteSel === x ? ' on' : '')} onClick={() => setCliente(x.cliente)} title={x.cliente}>
                <span className="aqd-ccard-n ellip">{x.cliente}</span>
                <span className="aqd-ccard-r">
                  <span className={'aqd-heat aqd-' + niv}>{x.pct}%</span>
                  <small className="num">{x.cumplen}/{x.oficinas}</small>
                </span>
                <span className="aqd-ccard-bar"><i style={{ width: x.pct + '%', background: NIV[niv] }} /></span>
                <small>{x.pendientes} pend. · {x.conATM} ATM · {x.conCheques} cheques</small>
              </button>
            );
          })}
        </div>
      )}

      <div className="aqd-grid4">
        <Tile label={'Oficinas' + (d.cliente ? ' · ' + d.cliente : '')} value={n0(t.oficinas)} sub={t.propias + ' propias'} icon="building" tone="navy" />
        <Tile label="Con arqueo ejecutado" value={n0(t.conArqueo)} sub={t.cumplen + ' completas · ' + t.parciales + ' parciales'} icon="check" tone="green" />
        <Tile label="Pendientes de arqueo" value={n0(t.sinArqueo)} sub="Sin ningún formato en el mes" icon="x" tone="red" />
        <Tile label="Al día (a tiempo)" value={t.pctAlDia + '%'} sub={t.alDia + ' de ' + t.oficinas + ' · ' + t.extemporaneas + ' con extemporáneos'} icon="clock" tone="green" />
        <Tile label="Oficinas con ATM" value={n0(t.conATM)} sub={t.atmTotal + ' cajeros parametrizados'} icon="building" tone="cyan" />
        <Tile label="ATM con arqueo del mes" value={t.atmHechos + '/' + t.atmTotal} sub={t.pctATM + '% · válido 1 vez al mes'} icon="wallet" tone="cyan" />
        <Tile label="Oficinas con cheques Porvenir" value={n0(t.conCheques)} sub={t.chequesOK + ' con arqueo de cheques'} icon="receipt" tone="navy" />
        <Tile label="Cheques pendientes" value={n0(t.chequesPend)} sub={t.pctCheques + '% cumplimiento'} icon="receipt" tone={t.chequesPend ? 'red' : 'green'} />
      </div>

      <Panel title="Detalle por oficina" icon="list" flush sub={`${lista.length} de ${ofis.length} oficinas`}
        right={<Search value={busca} onChange={setBusca} placeholder="Buscar oficina, zona o líder" />}>
        <div className="aqd-filterbar">
          <Pills label="Filtrar oficinas" value={f} onChange={setF} items={[
            ['todas', 'Todas', ofis.length], ['conArqueo', 'Con arqueo', t.conArqueo], ['pendientes', 'Con pendientes', ofis.length - t.cumplen],
            ['alDia', 'Al día', t.alDia], ['atm', 'Con ATM', t.conATM], ['cheques', 'Cheques Porvenir', t.conCheques], ['gestion', 'Novedades abiertas', conGestion]
          ]} />
        </div>
        <SortTable rows={lista} cols={cols} rowKey={(o) => o.oficina + '|' + o.cliente} limit={50} empty="No hay oficinas para este filtro." />
        <p className="aqd-foot">Oficina = arqueo de efectivo FOR-GOR-020-09 · Cheques Porvenir = FOR-GOR-048-01 (oficinas con medio de pago EFECTIVO Y CHEQUE) · ATM = FOR-GOR-099-02, cada cajero cuenta una vez al mes. “Al día” = todos los formatos exigidos registrados y sin extemporáneos.</p>
      </Panel>
    </>
  );
}

