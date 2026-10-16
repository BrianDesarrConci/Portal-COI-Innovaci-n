// Mis Arqueos (líder) / Matriz de Arqueos (regional y analista). Portado de renderHistorial,
// histFiltrados, filaHist y pintarOficinasLider de app.decodificado.js.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import CountUp from '../../../components/CountUp.jsx';
import { Chip, ErrorBox, Empty, SkeletonRows, useAq, useLlamada, mesNombre } from './shared.jsx';
import { BadgesGestion, Soportes, difTexto, difTono, registrarHist } from './Gestion.jsx';

// 100 filas por página como V1; en celular (fichas apiladas) se muestran menos de entrada.
const PAGINA = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 30 : 100;
/** Mes y filtro elegidos (sobreviven al cambio de pestaña, como HIST_MES / HIST_FILTRO_SIG de V1). */
export const HIST_STATE = { mes: '', filtroSig: '', reset() { this.mes = ''; this.filtroSig = ''; } };

export default function Historial() {
  const { user, mesHoy, abrir } = useAq();
  const esSuper = user.rol !== 'Lider';
  const [mes, setMes] = useState(HIST_STATE.mes || mesHoy);
  const [filtro, setFiltro] = useState(() => { const f = HIST_STATE.filtroSig || 'todos'; HIST_STATE.filtroSig = ''; return f; });
  const [q, setQ] = useState('');
  const [qd, setQd] = useState('');
  const [limite, setLimite] = useState(PAGINA);
  useEffect(() => { const t = setTimeout(() => { setQd(q.toLowerCase().trim()); setLimite(PAGINA); }, 180); return () => clearTimeout(t); }, [q]);

  const hist = useLlamada('hist|' + user.idUsuario + '|' + mes, 'obtenerHistorial', [user.idUsuario, user.rol, mes], [mes]);
  const meses = useLlamada('meses|' + user.idUsuario, 'obtenerMesesDisponibles', [user.idUsuario, user.rol]);

  const HIST = useMemo(() => {
    const data = Array.isArray(hist.data) ? hist.data : [];
    registrarHist(data);
    return data.map((r) => ({ ...r, _txt: [r.oficina, r.nombreLider, r.lider, r.formato, r.modalidad, r.elemento, r.numeroElem, r.novedad, r.fechaReal, r.fechaCarga, r.id, r.tipologia, r.estadoRevision, r.estadoDiferencia, r.tipoVisita].join(' ').toLowerCase() }));
  }, [hist.data]);

  const cuenta = useMemo(() => ({
    pendL: HIST.filter((r) => r.pendienteLider && r.pendienteLider.length).length,
    pendA: HIST.filter((r) => r.pendienteAnalista).length,
    dif: HIST.filter((r) => r.novedad === 'FALTANTE' || r.novedad === 'SOBRANTE').length,
    ok: HIST.filter((r) => r.gestionOK).length,
    mes: HIST.filter((r) => r.mes === mesHoy).length,
    ext: HIST.filter((r) => r.extemporaneo === 'SÍ').length
  }), [HIST, mesHoy]);

  const lista = useMemo(() => HIST.filter((r) => {
    if (qd && r._txt.indexOf(qd) < 0) return false;
    if (filtro === 'mes') return r.mes === mesHoy;
    if (filtro === 'pend') return (r.pendienteLider && r.pendienteLider.length) || r.pendienteAnalista;
    if (filtro === 'dif') return r.novedad === 'FALTANTE' || r.novedad === 'SOBRANTE';
    if (filtro === 'ok') return !!r.gestionOK;
    return true;
  }), [HIST, qd, filtro, mesHoy]);
  const vis = lista.slice(0, limite);
  const resto = lista.length - vis.length;
  const nPend = esSuper ? cuenta.pendL + cuenta.pendA : cuenta.pendL;

  const cambiarMes = (m) => { HIST_STATE.mes = m; setMes(m); setLimite(PAGINA); };
  const opcionesMes = Array.isArray(meses.data) && meses.data.length ? meses.data : [mes];
  const filtros = [['todos', 'Todos', HIST.length], ['mes', 'Este mes', cuenta.mes], ['pend', esSuper ? 'Con novedad' : 'Pendientes', nPend, true], ['dif', 'Faltantes / Sobrantes', cuenta.dif], ['ok', 'OK', cuenta.ok]];

  return (
    <>
      <div className="aq-vhead">
        <div>
          <h2>{esSuper ? 'Matriz de Arqueos' : 'Mis Arqueos'}</h2>
          <p>{hist.loading ? 'Consultando registros…' : <><b>{lista.length === HIST.length ? HIST.length : lista.length + ' de ' + HIST.length}</b> registros {mes === 'TODOS' ? 'históricos' : 'de ' + mesNombre(mes) + ' (más las novedades abiertas de otros meses)'}. Cada fila tiene su PDF de soporte y su estado de gestión.</>}</p>
        </div>
        <label className="aq-sel">
          <Icon name="clock" /><span className="aq-sr">Mes</span>
          <select aria-label="Mes del historial" value={mes} onChange={(e) => cambiarMes(e.target.value)}>
            {opcionesMes.indexOf(mes) < 0 && mes !== 'TODOS' && <option value={mes}>{mesNombre(mes)}</option>}
            {opcionesMes.map((m) => <option key={m} value={m}>{mesNombre(m)}</option>)}
            <option value="TODOS">Todos los meses</option>
          </select>
        </label>
      </div>

      {!esSuper && <OficinasLider />}

      <div className="aq-kpis">
        <Kpi icon="layers" tone="navy" label="Registros" v={HIST.length} sub={cuenta.ext + ' extemporáneo(s)'} loading={hist.loading} />
        <Kpi icon="bell" tone="bad" label={esSuper ? 'Con novedad abierta' : 'Pendientes por responder'} v={nPend} sub={esSuper ? cuenta.pendA + ' por confirmar OK' : 'Alerta persistente'} loading={hist.loading} />
        <Kpi icon="alert" tone="warn" label="Faltantes / sobrantes" v={cuenta.dif} sub="Con diferencia registrada" loading={hist.loading} />
        <Kpi icon="check" tone="ok" label="Gestión OK" v={cuenta.ok} sub="Listos para consolidación" loading={hist.loading} />
      </div>

      <div className="card aq-tablecard">
        <div className="aq-toolbar">
          <div className="aq-seg" role="tablist" aria-label="Filtro de registros">
            {filtros.map(([id, t, c, hot]) => (
              <button key={id} role="tab" aria-selected={filtro === id} className={filtro === id ? 'on' : ''} onClick={() => { setFiltro(id); setLimite(PAGINA); }}>
                {t}{c > 0 && <span className={'aq-seg-n' + (hot ? ' hot' : '')}>{c}</span>}
              </button>
            ))}
          </div>
          <label className="aq-search">
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={esSuper ? 'Buscar oficina, formato, líder…' : 'Buscar oficina, formato, novedad…'} aria-label="Buscar en los registros" />
          </label>
        </div>
        {hist.error ? <div className="aq-pad"><ErrorBox error={hist.error} onRetry={hist.reload} /></div>
          : hist.loading ? <div className="aq-pad"><SkeletonRows rows={7} /></div>
            : !vis.length ? <Empty icon={HIST.length ? 'search' : 'inbox'} title={HIST.length ? 'No hay registros para este filtro.' : 'Aún no hay arqueos registrados.'}>{HIST.length ? 'Pruebe con otro filtro o término de búsqueda.' : (esSuper ? 'Los arqueos que carguen los líderes aparecerán aquí.' : 'Use «Cargar Arqueo» para registrar el primero del mes.')}</Empty>
              : (
                <div className="aq-scroll">
                  <table className="t aq-table">
                    <thead><tr>
                      <th>Oficina</th>{esSuper && <th>Líder</th>}<th>Fechas</th><th>Formato</th><th>Estado</th><th className="r">Diferencia</th><th>Gestión</th><th>Soporte</th><th className="r">Acción</th>
                    </tr></thead>
                    <tbody>{vis.map((r) => <Fila key={r.id} r={r} esSuper={esSuper} user={user} abrir={abrir} />)}</tbody>
                  </table>
                </div>
              )}
        {!hist.loading && !hist.error && (resto > 0 || lista.length > PAGINA) && (
          <div className="aq-more">
            {resto > 0 ? <button className="btn btn-o" onClick={() => setLimite((l) => l + PAGINA)}>Mostrar {Math.min(resto, PAGINA)} más · {resto} restante(s)</button>
              : <span className="aq-dim small">{lista.length} registros mostrados</span>}
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({ icon, tone, label, v, sub, loading }) {
  return (
    <div className={'aq-kpi ' + tone}>
      <span className="aq-kpi-ic"><Icon name={icon} /></span>
      <div><p>{label}</p><b>{loading ? <span className="sk" style={{ display: 'inline-block', width: 48, height: 24 }} /> : <CountUp value={v} />}</b><small>{sub}</small></div>
    </div>
  );
}

function Fila({ r, esSuper, user, abrir }) {
  const pendL = r.pendienteLider && r.pendienteLider.length;
  const oport = r.extemporaneo === 'SÍ' ? <Chip tone="bad" icon="clock">Extemporáneo</Chip>
    : r.extemporaneo === 'NORMALIZADO' ? <Chip tone="info" icon="check">Normalizado</Chip> : <Chip tone="ok">A tiempo</Chip>;
  const mod = r.modalidad === 'VIRTUAL' ? <Chip tone="navy" icon="eye">Virtual</Chip> : r.modalidad === 'PRESENCIAL' ? <Chip tone="ok" icon="pin">Presencial</Chip> : null;
  const nov = r.novedad === 'FALTANTE' ? <Chip tone="bad">Faltante</Chip> : r.novedad === 'SOBRANTE' ? <Chip tone="warn">Sobrante</Chip>
    : r.novedad === 'PENDIENTE' ? <Chip tone="mute">Pendiente</Chip> : r.novedad === 'SIN NOVEDAD' ? <Chip tone="ok">OK</Chip> : null;

  const acciones = [];
  if (user.rol === 'Lider') {
    if (pendL) acciones.push(<button key="r" className="btn btn-sm aq-btn-hot" onClick={() => abrir('respuesta', r.id)}><Icon name="send" />Responder</button>);
    if (r.extemporaneo === 'SÍ') {
      if (r.estadoNorm === 'PENDIENTE') acciones.push(<Chip key="n" tone="warn" icon="clock">En revisión</Chip>);
      else if (r.estadoNorm === 'RECHAZADA') acciones.push(<button key="n" className="btn btn-g btn-sm aq-t-bad" onClick={() => abrir('normalizar', r.id)}><Icon name="flow" />Rechazada · Reintentar</button>);
      else acciones.push(<button key="n" className="btn btn-o btn-sm" onClick={() => abrir('normalizar', r.id)}><Icon name="flow" />Normalizar</button>);
    }
    if (!acciones.length) acciones.push(<button key="d" className="btn btn-g btn-sm" onClick={() => abrir('detalle', r.id)}><Icon name="eye" />Detalle</button>);
  } else {
    acciones.push(<button key="g" className={'btn btn-sm ' + (r.pendienteAnalista ? 'aq-btn-cyan' : 'btn-o')} onClick={() => abrir('gestion', r.id)}><Icon name="filecheck" />{r.pendienteAnalista ? 'Confirmar' : 'Gestionar'}</button>);
  }

  return (
    <tr className={(pendL ? 'aq-row-pend' : '') + (r.atmRepetido ? ' aq-row-rep' : '')}>
      <td data-label="Oficina"><div className="cell-main">{r.oficina}</div><div className="cell-sub">{[r.elemento, r.numeroElem].filter(Boolean).join(' ') || '—'}</div></td>
      {esSuper && <td data-label="Líder"><span className="aq-small">{r.nombreLider || r.lider}</span></td>}
      <td data-label="Fechas"><div className="cell-main num">{r.fechaReal}</div><div className="cell-sub num" title="Carga en el sistema">Carga {r.fechaCarga}</div></td>
      <td data-label="Formato">
        <div className="aq-mono strong">{r.formato || '—'}</div>
        <div className="aq-tags">
          {r.tipoVisita === 'VISITA ADICIONAL' && <span className="aq-tag cyan">Visita adicional</span>}
          {r.atmRepetido ? <span className="aq-tag gold" title={'El cajero ya contó el ' + r.atmPrimero}>ATM ya contado</span>
            : r.cuentaMeta ? <span className="aq-tag green">Suma a la meta</span> : <span className="aq-tag">Complementario</span>}
        </div>
      </td>
      <td data-label="Estado"><div className="aq-chips">{oport}{mod}</div></td>
      <td data-label="Diferencia" className="r"><div className="aq-chips end">{nov}</div><b className={'num aq-t-' + difTono(r)}>{difTexto(r)}</b></td>
      <td data-label="Gestión"><BadgesGestion r={r} /></td>
      <td data-label="Soporte"><Soportes r={r} compact /></td>
      <td data-label="" className="r"><div className="aq-rowacts">{acciones}</div></td>
    </tr>
  );
}

/** Oficinas con arqueo cargado y pendientes del mes (pintarOficinasLider). */
function OficinasLider() {
  const { user, mesHoy } = useAq();
  const d = useLlamada('cli|' + user.idUsuario + '|' + mesHoy + '|', 'obtenerDashboardClientes', [user.idUsuario, user.rol, mesHoy, '']);
  if (d.loading) return <div className="card aq-ofis"><SkeletonRows rows={2} /></div>;
  if (d.error || !d.data || !d.data.success) return null;
  const ofs = d.data.oficinas || [];
  const con = ofs.filter((o) => o.conArqueo), sin = ofs.filter((o) => !o.conArqueo);
  const pct = ofs.length ? Math.round((con.length / ofs.length) * 100) : 0;
  return (
    <div className="card aq-ofis">
      <div className="aq-ofis-h">
        <div className="aq-ring" style={{ '--p': pct }} aria-label={pct + '% de oficinas con arqueo'}><span>{pct}%</span></div>
        <div>
          <h3>Oficinas con arqueo cargado · {mesNombre(mesHoy)}</h3>
          <div className="aq-chips"><Chip tone="ok">{con.length} con arqueo</Chip><Chip tone="bad">{sin.length} pendientes</Chip><Chip tone="mute">{ofs.length} a cargo</Chip></div>
        </div>
      </div>
      <div className="aq-ofis-g">
        <div>
          <p className="aq-sec-lbl">Con arqueo este mes</p>
          <div className="aq-pillofs">
            {con.length ? con.map((o) => (
              <span key={o.oficina} className="aq-pillofi ok" title={o.estadoGeneral}>
                <Icon name="check" />{o.oficina}
                <small>{o.visitas} visita(s){o.exige && o.exige.atm ? ' · ATM ' + o.atmHechos + '/' + o.atmTotal : ''}{o.exige && o.exige.cheques ? ' · CHQ ' + (o.estadoCheques === 'OK' ? '✓' : '✗') : ''}{o.pendientes && o.pendientes.length ? ' · falta ' + o.pendientes.join('/') : ''}</small>
              </span>
            )) : <span className="aq-dim small">Aún no has cargado arqueos este mes.</span>}
          </div>
        </div>
        <div>
          <p className="aq-sec-lbl">Pendientes por arquear</p>
          <div className="aq-pillofs">
            {sin.length ? sin.map((o) => (
              <span key={o.oficina} className="aq-pillofi pend"><span className="aq-dotc" />{o.oficina}{o.exige && o.exige.atm && <small>ATM</small>}{o.exige && o.exige.cheques && <small>CHQ</small>}</span>
            )) : <span className="aq-t-ok small strong">¡Todas tus oficinas tienen arqueo este mes!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

