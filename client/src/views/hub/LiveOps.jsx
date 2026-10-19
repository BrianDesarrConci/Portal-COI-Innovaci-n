// Tablero gerencial · "Operación en vivo": banda con datos REALES de los libros de COI V1
// (Google Sheets) — arqueos del mes, diferencias de caja, bajas y backups, PQR y la red de
// oficinas — separada visualmente del índice de servicio simulado del catálogo.
import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import CountUp from '../../components/CountUp.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { gas } from '../../lib/gas.js';
import { fmt, MONTHS } from '../../lib/format.js';
import './hub.css';

// Última lectura: al volver al tablero se muestra al instante y se refresca en segundo plano.
const CACHE = { data: null, meta: null };

export const moneyShort = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e9) return '$ ' + fmt(v / 1e9, 1) + ' mil M';
  if (v >= 1e6) return '$ ' + fmt(v / 1e6, 1) + ' M';
  return '$ ' + fmt(v);
};
const money = (n) => '$ ' + fmt(Math.abs(Number(n) || 0));
const mesLargo = (mes) => { const [y, m] = String(mes || '').split('-').map(Number); return m ? MONTHS[m - 1] + ' ' + y : ''; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function fechaCopia(meta) {
  const d = meta && meta.extraido ? new Date(meta.extraido) : null;
  if (!d || isNaN(d)) return null;
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Insignia de origen: "Google Sheets · copia del …" (o "en vivo" si el servidor lee Sheets directo). */
export function SourceBadge({ meta, compact }) {
  const vivo = meta && meta.driver === 'sheets';
  const f = fechaCopia(meta);
  return (
    <span className={'hub-src' + (compact ? ' compact' : '')} title="Origen de los datos de esta sección">
      <span className={'hub-dot' + (vivo ? ' live' : '')} />
      <b>Google Sheets</b>
      <span>{vivo ? 'en vivo' : f ? 'copia del ' + f : 'copia de los libros de COI V1'}</span>
    </span>
  );
}

export function useMeta() {
  const [meta, setMeta] = useState(CACHE.meta);
  useEffect(() => {
    if (CACHE.meta) return;
    fetch('/api/coiv1/meta').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m) { CACHE.meta = m; setMeta(m); } }).catch(() => {});
  }, []);
  return meta;
}

const ACCESOS = [
  ['arqueos', 'Control de arqueos', 'wallet'],
  ['granja', 'Granja de usuarios', 'users'],
  ['pqr/radicacion', 'Radicar PQR', 'message'],
  ['captura', 'Centro de captura', 'form'],
  ['brain', 'Brain RT · Oracle', 'layers'],
  ['adminv1', 'Usuarios y permisos', 'shield']
];

export default function LiveOps() {
  const { go } = useApp();
  const meta = useMeta();
  const [r, setR] = useState(CACHE.data);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(() => {
    setBusy(true); setErr(null);
    gas('resumenTableroReal').then((x) => { CACHE.data = x; setR(x); }).catch(setErr).finally(() => setBusy(false));
  }, []);
  useEffect(cargar, [cargar]);

  return (
    <section className="hub-live" aria-labelledby="hub-live-t">
      <header className="hub-live-h">
        <div>
          <span className="hub-eyebrow"><span className="hub-pulse" />Operación en vivo · datos reales</span>
          <h2 id="hub-live-t">{r ? cap(mesLargo(r.mes)) : 'Mes en curso'} · lo que pasa hoy en la red</h2>
        </div>
        <div className="hub-live-hr">
          <SourceBadge meta={meta} />
          <button type="button" className={'hub-icon-btn' + (busy ? ' spin' : '')} onClick={cargar} disabled={busy} title="Actualizar" aria-label="Actualizar datos reales"><Icon name="activity" /></button>
        </div>
      </header>

      {err && !r ? (
        <div className="hub-err" role="alert">
          <Icon name="alert" />
          <span className="grow"><b>No se pudieron leer los libros de COI V1.</b><small>{err.message}</small></span>
          <button type="button" className="btn btn-o btn-sm" onClick={cargar}>Reintentar</button>
        </div>
      ) : !r ? <LiveSkeleton /> : (
        <div className="hub-live-grid">
          <ArqueosTile a={r.arqueos} onGo={() => go('arqueos')} />
          <DiferenciasTile a={r.arqueos} onGo={() => go('arqueos')} />
          <PersonasTile p={r.personas} onGo={() => go('granja')} />
          <PqrTile q={r.pqr} onGo={() => go('pqr/radicacion')} />
          <RedTile red={r.red} a={r.arqueos} onGo={() => go('clientes')} />
        </div>
      )}

      <nav className="hub-access" aria-label="Accesos operativos">
        <span className="hub-access-l">Accesos</span>
        {ACCESOS.map(([to, label, icon]) => (
          <button key={to} type="button" onClick={() => go(to)}><Icon name={icon} />{label}</button>
        ))}
      </nav>
    </section>
  );
}

function Tile({ className = '', onGo, label, icon, color, children, cta, error }) {
  return (
    <button type="button" className={'hub-tile ' + className} style={{ '--c': color }} onClick={onGo}>
      <span className="hub-tile-h"><span className="hub-tile-ic"><Icon name={icon} /></span><span className="hub-tile-l">{label}</span><Icon name="chevron" className="hub-tile-go" /></span>
      {error ? <span className="hub-tile-err"><Icon name="alert" />No disponible: {error}</span> : children}
      {cta && !error && <span className="hub-tile-cta">{cta}</span>}
    </button>
  );
}

function ArqueosTile({ a, onGo }) {
  if (a.error) return <Tile className="hub-arq" label="Arqueos del mes" icon="wallet" color="#048C38" onGo={onGo} error={a.error} />;
  const L = a.lideres;
  const esperadoPct = a.metaGlobal ? Math.min(100, a.esperadoALaFecha / a.metaGlobal * 100) : 0;
  const brecha = a.validos - a.esperadoALaFecha;
  const segs = [['En meta o en ruta', L.enMeta + L.enRuta, 'ok'], ['En riesgo', L.enRiesgo, 'warn'], ['Críticos', L.criticos, 'bad']].filter((s) => s[1] > 0 || s[2] !== 'warn');
  return (
    <Tile className="hub-arq" label="Arqueos válidos del mes" icon="wallet" color="#048C38" onGo={onGo} cta={<>Ver Control de arqueos<Icon name="chevron" /></>}>
      <span className="hub-arq-top">
        <span className="hub-big num"><CountUp value={fmt(a.validos)} /><small>de {fmt(a.metaGlobal)}</small></span>
        <span className="hub-arq-pct"><b className="num">{fmt(a.pct)} %</b><small>de la meta mensual</small></span>
      </span>
      <span className="hub-meter" aria-label={'Cumplimiento ' + a.pct + ' %'}>
        <i style={{ width: Math.min(100, a.pct) + '%' }} />
        <em style={{ left: esperadoPct + '%' }} title={'Esperado a la fecha: ' + fmt(a.esperadoALaFecha)} />
      </span>
      <span className="hub-meter-l">
        <span>Día hábil {a.habiles.transcurridos} de {a.habiles.total}</span>
        <span className={brecha >= 0 ? 'up' : 'dn'}>{brecha >= 0 ? '+' : '−'}{fmt(Math.abs(brecha))} frente al ritmo esperado ({fmt(a.esperadoALaFecha)})</span>
      </span>
      <PaceChart serie={a.serie} meta={a.metaGlobal} mes={a.mes} />
      <span className="hub-lid">
        <span className="hub-lid-bar">{segs.map((s) => <i key={s[0]} className={s[2]} style={{ flexGrow: s[1] }} />)}</span>
        <span className="hub-lid-l">
          {segs.map((s) => <span key={s[0]}><i className={s[2]} /><b className="num">{fmt(s[1])}</b> {s[0].toLowerCase()}</span>)}
          <span className="muted">de {fmt(L.total)} líderes · meta {a.meta} por líder</span>
        </span>
      </span>
      {a.anterior && <span className="hub-foot-note">{cap(mesLargo(a.mesAnterior))} cerró con {fmt(a.anterior.validos)} válidos ({fmt(a.anterior.pct)} % de la meta).</span>}
    </Tile>
  );
}

/** Acumulado de arqueos válidos frente a la línea de ritmo lineal hacia la meta. */
function PaceChart({ serie, meta, mes }) {
  const [y, m] = String(mes).split('-').map(Number);
  const dias = new Date(y, m, 0).getDate();
  if (!serie || serie.length < 2) return null;
  const W = 320, H = 70, P = 4;
  const max = Math.max(meta, ...serie) || 1;
  const X = (i) => P + (i / (dias - 1)) * (W - 2 * P), Y = (v) => H - P - (v / max) * (H - 2 * P);
  const line = serie.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  const area = line + ' L' + X(serie.length - 1).toFixed(1) + ' ' + (H - P) + ' L' + X(0) + ' ' + (H - P) + ' Z';
  const last = serie[serie.length - 1];
  return (
    <span className="hub-pace" role="img" aria-label={'Acumulado de ' + fmt(last) + ' arqueos válidos frente a la meta de ' + fmt(meta)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs><linearGradient id="hubPaceG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#048C38" stopOpacity=".28" /><stop offset="1" stopColor="#048C38" stopOpacity="0" /></linearGradient></defs>
        <line x1={X(0)} y1={Y(0)} x2={X(dias - 1)} y2={Y(meta)} className="hub-pace-goal" />
        <path d={area} fill="url(#hubPaceG)" />
        <path d={line} className="hub-pace-line" />
        {/* Punto final con trazo no escalable: se mantiene redondo aunque el SVG se estire. */}
        <path d={`M${X(serie.length - 1).toFixed(1)} ${Y(last).toFixed(1)} l0 0`} className="hub-pace-dot" />
        <path d={`M${X(serie.length - 1).toFixed(1)} ${Y(last).toFixed(1)} l0 0`} className="hub-pace-dot in" />
      </svg>
      <span className="hub-pace-lg"><span><i className="g" />Acumulado real</span><span><i className="c" />Ritmo hacia la meta</span></span>
    </span>
  );
}

function DiferenciasTile({ a, onGo }) {
  if (a.error) return <Tile label="Diferencias de caja" icon="receipt" color="#242A54" onGo={onGo} error={a.error} />;
  const n = a.novedades;
  return (
    <Tile label="Diferencias en arqueos" icon="receipt" color="#242A54" onGo={onGo}>
      <span className="hub-pair">
        <span className="hub-pair-i bad"><small>Faltantes</small><b className="num">{fmt(n.faltantes)}</b><em className="num" title={money(n.montoFaltante)}>{moneyShort(n.montoFaltante)}</em></span>
        <span className="hub-pair-i ok"><small>Sobrantes</small><b className="num">{fmt(n.sobrantes)}</b><em className="num" title={money(n.montoSobrante)}>{moneyShort(n.montoSobrante)}</em></span>
      </span>
      {n.mayor
        ? <span className="hub-note"><b>Mayor diferencia:</b> {n.mayor.oficina} · {n.mayor.elemento} · <span className="num nowrap">{money(n.mayor.diferencia)}</span> ({n.mayor.novedad.toLowerCase()})</span>
        : <span className="hub-note">Sin faltantes ni sobrantes en el mes.</span>}
    </Tile>
  );
}

function PersonasTile({ p, onGo }) {
  if (p.error) return <Tile label="Bajas de personal" icon="users" color="#21BBEA" onGo={onGo} error={p.error} />;
  return (
    <Tile label="Bajas de personal" icon="users" color="#1A8FB5" onGo={onGo}>
      <span className="hub-stat-row">
        <span className={'hub-big num' + (p.pendientes ? ' warn' : '')}><CountUp value={fmt(p.pendientes)} /><small>pendientes</small></span>
        <span className="hub-chip-n"><b className="num">{fmt(p.backupsDisponibles)}</b> backups disponibles</span>
      </span>
      <span className="hub-mini">
        <span><b className="num">{fmt(p.cubiertas)}</b> cubiertas</span>
        <span><b className="num">{fmt(p.resueltas)}</b> resueltas</span>
        <span><b className="num">{fmt(p.coberturaPct)} %</b> atendidas</span>
      </span>
      <span className="hub-note">{p.pendientes
        ? <>{fmt(p.oficinasAfectadas)} {p.oficinasAfectadas === 1 ? 'oficina afectada' : 'oficinas afectadas'}{p.pendienteMasAntiguaDias != null && <> · la más antigua lleva <b>{fmt(p.pendienteMasAntiguaDias)} días</b> sin backup</>}.</>
        : 'Todas las bajas reportadas tienen backup asignado.'}</span>
    </Tile>
  );
}

function PqrTile({ q, onGo }) {
  if (q.error) return <Tile label="PQR radicadas" icon="message" color="#6C74A8" onGo={onGo} error={q.error} />;
  return (
    <Tile label="PQR radicadas" icon="message" color="#6C74A8" onGo={onGo}>
      <span className="hub-stat-row">
        <span className="hub-big num"><CountUp value={fmt(q.radicadas)} /><small>en el libro PQR</small></span>
        <span className="hub-chip-n"><b className="num">{fmt(q.ultimos30)}</b> últimos 30 días</span>
      </span>
      <span className="hub-mini">
        <span><b className="num">{fmt(q.quejasReclamos)}</b> quejas y reclamos</span>
        <span><b className="num">{fmt(q.porTipo['Felicitación'] || 0)}</b> felicitaciones</span>
      </span>
      <span className="hub-note">{q.ultima ? <>Última: <b className="num">{q.ultima.id}</b> · {q.ultima.tipificacion} · {q.ultima.fecha}</> : 'Aún no hay radicaciones. Radique la primera desde PQR y experiencia.'}</span>
    </Tile>
  );
}

function RedTile({ red, a, onGo }) {
  const o = a && !a.error ? a.oficinas : null;
  return (
    <Tile label="Red de oficinas" icon="building" color="#242A54" onGo={onGo}>
      <span className="hub-stat-row">
        <span className="hub-big num"><CountUp value={fmt(red.oficinas)} /><small>oficinas activas</small></span>
        <span className="hub-chip-n"><b className="num">{fmt(red.personas)}</b> personas</span>
      </span>
      {o && <span className="hub-meter sm"><i className="cy" style={{ width: o.pct + '%' }} /></span>}
      <span className="hub-note">{o ? <><b className="num">{fmt(o.pct)} %</b> de las oficinas de clientes ya tiene arqueo válido este mes ({fmt(o.conArqueo)} de {fmt(o.total)}).</> : fmt(red.georreferenciadas) + ' personas georreferenciadas en el directorio.'}</span>
    </Tile>
  );
}

function LiveSkeleton() {
  return (
    <div className="hub-live-grid" aria-busy="true" aria-label="Cargando datos reales">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={'hub-tile hub-sk-tile' + (i === 0 ? ' hub-arq' : '')}>
          <span className="hub-sk" style={{ width: '45%', height: 12 }} />
          <span className="hub-sk" style={{ width: '60%', height: 30, marginTop: 14 }} />
          <span className="hub-sk" style={{ width: '90%', height: 10, marginTop: 14 }} />
          {i === 0 && <span className="hub-sk" style={{ width: '100%', height: 90, marginTop: 14 }} />}
          <span className="hub-sk" style={{ width: '70%', height: 10, marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}
