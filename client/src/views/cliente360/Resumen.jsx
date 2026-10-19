// Cliente 360 · Resumen: cifras clave, tendencia de arqueos, alertas y presencia nacional.
import { useMemo } from 'react';
import Icon from '../../components/Icon.jsx';
import { Spark } from '../../components/ui.jsx';
import { fmt } from '../../lib/format.js';
import Mapa from './Mapa.jsx';
import { Barras, Empty, mesLargo, moneyCorto, Ring, SerieMeses, Tile, titulo, tono } from './shared.jsx';

const COLOR_ESTADO = (o) => (o.cumpleMes ? '#048C38' : o.estadoMes === 'PARCIAL' ? '#21BBEA' : '#242A54');

export function porRegional(oficinas) {
  const m = {};
  oficinas.forEach((o) => { const r = (m[o.regional] = m[o.regional] || { nombre: o.regional, n: 0, ok: 0 }); r.n++; if (o.cumpleMes) r.ok++; });
  return Object.values(m).map((r) => ({ ...r, pct: Math.round((r.ok / r.n) * 100) })).sort((a, b) => b.n - a.n);
}

function alertas(d) {
  const k = d.kpis, a = [], t = d.arqueos.totalesMes, mes = mesLargo(d.mes);
  if (t.oficinas && t.oficinas - t.cumplen > 0) a.push({ tone: t.pctCumplimiento < 60 ? 'warn' : 'info', icon: 'clock', title: fmt(t.oficinas - t.cumplen) + ' oficinas sin cumplir el arqueo de ' + mes, sub: fmt(t.sinArqueo) + ' sin ningún arqueo y ' + fmt(t.parciales) + ' parciales', tab: 'arqueos' });
  if (k.faltantesMes) a.push({ tone: 'bad', icon: 'alert', title: fmt(k.faltantesMes) + (k.faltantesMes === 1 ? ' faltante' : ' faltantes') + ' en arqueos del mes', sub: 'Por ' + moneyCorto(k.montoFaltanteMes) + ' en total', tab: 'arqueos' });
  if (k.sobrantesMes) a.push({ tone: 'info', icon: 'wallet', title: fmt(k.sobrantesMes) + (k.sobrantesMes === 1 ? ' sobrante' : ' sobrantes') + ' registrados', sub: 'Por ' + moneyCorto(k.montoSobranteMes) + ' en total', tab: 'arqueos' });
  if (t.atmTotal && t.pctATM < 100) a.push({ tone: 'warn', icon: 'box', title: fmt(t.atmTotal - t.atmHechos) + ' cajeros ATM sin arqueo en el mes', sub: fmt(t.atmHechos) + ' de ' + fmt(t.atmTotal) + ' arqueados', tab: 'arqueos' });
  if (k.novedadesAbiertas) a.push({ tone: 'warn', icon: 'users', title: fmt(k.novedadesAbiertas) + (k.novedadesAbiertas === 1 ? ' novedad de personal abierta' : ' novedades de personal abiertas'), sub: 'Bajas reportadas en la Granja de usuarios', tab: 'personal' });
  if (k.oficinasSinPersonal) a.push({ tone: 'warn', icon: 'usercheck', title: fmt(k.oficinasSinPersonal) + (k.oficinasSinPersonal === 1 ? ' oficina sin personal registrado' : ' oficinas sin personal registrado'), sub: 'No aparecen en la Granja de usuarios', tab: 'personal' });
  if (k.personas && !k.backups) a.push({ tone: 'warn', icon: 'shield', title: 'Sin personal backup disponible', sub: 'Ninguna persona marcada como backup', tab: 'personal' });
  const sinGeo = d.oficinas.filter((o) => o.lat === null).length;
  if (sinGeo) a.push({ tone: 'mute', icon: 'pin', title: fmt(sinGeo) + (sinGeo === 1 ? ' oficina sin coordenadas' : ' oficinas sin coordenadas'), sub: 'Completar LATITUD / LONGITUD en el Directorio', tab: 'red' });
  return a;
}

export default function Resumen({ c, d, cat, setTab }) {
  const k = d.kpis;
  const regionales = useMemo(() => (k ? porRegional(d.oficinas) : []), [d, k]);
  if (!k) return <ResumenSinRed c={c} d={d} cat={cat} setTab={setTab} />;
  const t = d.arqueos.totalesMes;
  const al = alertas(d);
  const delta = k.pctMes !== null && k.pctMesAnterior !== null && d.kpis.serie[4] && d.kpis.serie[4].conDatos ? k.pctMes - k.pctMesAnterior : null;
  const extra = d.red && d.red.puntos > k.oficinas ? d.red : null;
  return (
    <div className="c360-stack">
      <div className="c360-tiles">
        <Tile label="Oficinas activas" value={fmt(k.oficinas)} icon="building" sub={fmt(k.municipios) + ' municipios · ' + fmt(k.departamentos) + ' departamentos'} onClick={() => setTab('red')} />
        <Tile label="Personas en la Granja" value={fmt(k.personas)} icon="users" tone="cyan" sub={fmt(k.backups) + ' backup disponibles' + (d.personal.conUsuario ? ' · ' + fmt(d.personal.conUsuario) + ' con usuario' : '')} onClick={() => setTab('personal')} />
        <Tile label={'Cumplimiento de arqueos'} value={k.pctMes === null ? '—' : fmt(k.pctMes)} unit={k.pctMes === null ? '' : '%'} icon="filecheck" tone={tono(k.pctMes) === 'ok' ? 'green' : tono(k.pctMes) === 'warn' ? 'gold' : 'cyan'}
          sub={<>{fmt(t.cumplen)} de {fmt(t.oficinas)} oficinas en {mesLargo(d.mes)}{delta !== null && <b className={delta >= 0 ? 'up' : 'down'}> {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts</b>}</>} onClick={() => setTab('arqueos')} />
        <Tile label="Alertas activas" value={fmt(al.filter((x) => x.tone !== 'mute').length)} icon="bell" tone={al.some((x) => x.tone === 'bad') ? 'gold' : 'navy'} sub={fmt(k.novedadesAbiertas) + ' novedades abiertas · ' + fmt(k.faltantesMes) + ' faltantes'} />
      </div>

      <div className="c360-grid-main">
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Arqueos de los últimos seis meses</h3><p>Arqueos registrados y porcentaje de oficinas que cumplen (Control de Arqueos)</p></div>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setTab('arqueos')}>Detalle<Icon name="chevron" /></button></header>
          <div className="c360-cb"><SerieMeses serie={d.arqueos.serie} /></div>
        </section>
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Alertas y focos</h3><p>Lo que requiere gestión hoy</p></div></header>
          <div className="c360-cb c360-alerts">
            {al.length ? al.map((x, i) => (
              <button type="button" key={i} className={'c360-alert a-' + x.tone} onClick={() => setTab(x.tab)}>
                <span className="ai"><Icon name={x.icon} /></span>
                <span className="grow"><b>{x.title}</b><small>{x.sub}</small></span>
                <Icon name="chevron" className="go" />
              </button>
            )) : <Empty icon="check" title="Sin alertas">La operación del cliente está al día.</Empty>}
          </div>
        </section>
      </div>

      <div className="c360-grid2">
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Cumplimiento por regional</h3><p>Oficinas que cumplen el arqueo de {mesLargo(d.mes)}</p></div></header>
          <div className="c360-cb">
            <div className="c360-reg">
              {regionales.map((r) => (
                <div key={r.nombre} className="c360-reg-row">
                  <Ring v={r.pct} size={48} stroke={5} />
                  <div className="grow"><b>{titulo(r.nombre)}</b><small>{fmt(r.ok)} de {fmt(r.n)} oficinas</small>
                    <span className="c360-mini"><i style={{ width: r.pct + '%' }} className={'t-' + tono(r.pct)} /></span></div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Presencia nacional</h3><p>{fmt(k.oficinas)} oficinas en {fmt(k.departamentos)} departamentos</p></div>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setTab('red')}>Ver red<Icon name="chevron" /></button></header>
          <div className="c360-cb c360-presencia">
            <Mapa oficinas={d.oficinas} colorDe={COLOR_ESTADO} leyenda={[['Cumple', '#048C38'], ['Parcial', '#21BBEA'], ['Pendiente', '#242A54']]} label={'Oficinas de ' + c.nombre} />
            <div><div className="c360-kicker">Departamentos con más oficinas</div><Barras rows={d.distribucion.departamento} max={6} total={k.oficinas} /></div>
          </div>
        </section>
      </div>

      {(extra || cat) && (
        <div className="c360-grid2">
          {extra && (
            <section className="card c360-card c360-note-card">
              <span className="ni"><Icon name="layers" /></span>
              <div><h4>Red habilitada para {c.nombre}</h4>
                <p>Además de sus {fmt(k.oficinas)} oficinas dedicadas, <b>{fmt(extra.puntos)} puntos</b> de la red Reval · Multipagas tienen código de {c.nombre} en el Directorio Nacional, en {fmt(extra.municipios)} municipios de {fmt(extra.departamentos)} departamentos.</p>
                <button type="button" className="btn btn-o btn-sm" onClick={() => setTab('red')}>Ver puntos habilitados</button></div>
            </section>
          )}
          {cat && <AcuerdoSnapshot cat={cat} setTab={setTab} />}
        </div>
      )}
    </div>
  );
}

export function AcuerdoSnapshot({ cat, setTab }) {
  const { x, met } = cat;
  return (
    <section className="card c360-card c360-note-card">
      <span className="ni gold"><Icon name="shield" /></span>
      <div className="grow">
        <h4>Acuerdo de nivel de servicio {x.ans}</h4>
        <p>{met} de {x.clauses.length} cláusulas cumplidas en la medición del mes. Evaluación vigente del cliente: <b>{fmt(x.score[5], 1)} / 5</b>.</p>
        <div className="c360-snap">
          <Spark values={x.score} w={140} h={34} color="#242A54" />
          <button type="button" className="btn btn-o btn-sm" onClick={() => setTab('acuerdo')}>Ver acuerdo y operación</button>
        </div>
      </div>
    </section>
  );
}

function ResumenSinRed({ c, d, cat, setTab }) {
  const r = d.red;
  return (
    <div className="c360-stack">
      <div className="c360-banner">
        <Icon name="layers" />
        <div><b>{c.nombre} no tiene oficinas dedicadas en el Directorio Nacional.</b> Se atiende desde la red propia Reval · Multipagas{r && r.puntos ? ': los puntos habilitados son las oficinas con código de ' + c.nombre + ' en el Directorio' : ''}. Arqueos y personal se gestionan en la red de cada oficina.</div>
      </div>
      {r && r.puntos > 0 ? (
        <>
          <div className="c360-tiles">
            <Tile label="Puntos habilitados" value={fmt(r.puntos)} icon="store" sub={'Oficinas con código de ' + c.nombre} onClick={() => setTab('red')} />
            <Tile label="Departamentos" value={fmt(r.departamentos)} icon="pin" tone="cyan" sub={fmt(r.municipios) + ' municipios con atención'} />
            <Tile label="Regionales" value={fmt(r.porRegional.length)} icon="layers" tone="green" sub={r.porRegional[0] ? 'Mayor presencia: ' + titulo(r.porRegional[0].nombre) : ''} />
            <Tile label="Personas con usuario" value={fmt(r.personasConUsuario)} icon="users" tone="navy" sub={r.personasConUsuario ? 'Usuario del cliente en la Granja' : 'Sin columna de usuario en la Granja'} />
          </div>
          <div className="c360-grid2">
            <section className="card c360-card">
              <header className="c360-ch"><div><h3>Puntos de atención en el país</h3><p>Oficinas de la red con código de {c.nombre}</p></div></header>
              <div className="c360-cb"><Mapa oficinas={r.oficinas} leyenda={[['Punto habilitado', '#048C38', r.puntos]]} colorDe={() => '#048C38'} label={'Puntos de ' + c.nombre} /></div>
            </section>
            <section className="card c360-card">
              <header className="c360-ch"><div><h3>Distribución</h3><p>Por departamento y regional</p></div></header>
              <div className="c360-cb">
                <div className="c360-kicker">Departamentos</div><Barras rows={r.porDepartamento} max={8} total={r.puntos} color="var(--green)" />
                <div className="c360-kicker mt">Regionales</div><Barras rows={r.porRegional} max={5} total={r.puntos} />
              </div>
            </section>
          </div>
        </>
      ) : <section className="card c360-card"><Empty icon="layers" title="Sin puntos habilitados registrados">El Directorio Nacional no tiene una columna de código para {c.nombre}.</Empty></section>}
      {cat && <div className="c360-grid2"><AcuerdoSnapshot cat={cat} setTab={setTab} /></div>}
    </div>
  );
}

