// Historial de novedades atendidas (cargarHistorialNovedadesCompleto, extenderNovedad y
// cerrarNovedad de js.html). Acciones solo sobre las novedades CUBIERTA.
import { useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { useApp } from '../../../../context/AppContext.jsx';
import { fmt, norm } from '../../../../lib/format.js';
import { Panel, Seg, Empty, PIcon, Pill, Modal, F, gas } from '../kit.jsx';
import { parseFecha, fechaCorta, fechaHora } from '../granjaLogic.js';

function Timeline({ n }) {
  const rep = parseFecha(n.fechaReporte);
  const ini = n.fechaInicioISO ? new Date(n.fechaInicioISO) : null;
  const fin = n.fechaFinISO ? new Date(n.fechaFinISO) : null;
  const res = parseFecha(n.fechaResolucion);
  const auto = /SISTEMA/i.test(n.adminNombre);
  const steps = [
    ['bell', 'Baja reportada', rep ? fechaHora(rep) : n.fechaReporte, 'Por ' + (n.reportadoPor || '—') + ' · ' + n.descripcion, 'done'],
    ['calendar', 'Inicio de la ausencia', ini ? fechaCorta(ini) : '—', n.diasAusencia + ' ' + (n.diasAusencia === '1' ? 'día' : 'días') + ' de ausencia', 'done'],
    ['usercheck', 'Backup asignado', n.backup && n.backup !== 'No asignado' ? n.backup : 'Sin backup', 'Cobertura en ' + n.oficina, n.backup && n.backup !== 'No asignado' ? 'done' : 'skip'],
    n.estado === 'RESUELTA'
      ? ['check', auto ? 'Cierre automático' : 'Novedad cerrada', res ? fechaHora(res) : (n.fechaResolucion || '—'), auto ? 'Cerrada por SISTEMA AUTOMÁTICO al vencer los días' : 'Cerrada por ' + (n.adminNombre || '—'), 'done']
      : ['hourglass', 'Fin previsto', fin ? fechaCorta(fin) : '—', 'Se cierra automáticamente y libera al backup', 'now']
  ];
  return (
    <ol className="v1p-tl">
      {steps.map((s, i) => (
        <li key={i} className={s[4]}>
          <span className="v1p-tl-dot"><PIcon name={s[0]} /></span>
          <div><b>{s[1]}</b><span className="v1p-tl-when">{s[2]}</span><small>{s[3]}</small></div>
        </li>
      ))}
    </ol>
  );
}

function Progreso({ n }) {
  const ini = n.fechaInicioISO ? new Date(n.fechaInicioISO) : null;
  const dias = Number(n.diasAusencia) || 0;
  if (!ini || !dias) return null;
  const pasado = Math.max(0, (Date.now() - ini.getTime()) / 86400000);
  const p = Math.max(0, Math.min(100, (pasado / dias) * 100));
  const quedan = Math.max(0, Math.ceil(dias - pasado));
  return (
    <div className="v1p-prog" title={`${fmt(p, 0)} % del periodo de cobertura`}>
      <span className="v1p-prog-bar"><i style={{ width: p + '%' }} /></span>
      <small className="num">{pasado < 0 ? 'Inicia pronto' : quedan === 0 ? 'Vence hoy' : `Quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}`}</small>
    </div>
  );
}

export default function Historial({ items, sesion, esAdmin, onChange }) {
  const { toast } = useApp();
  const [estado, setEstado] = useState('TODAS');
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [limite, setLimite] = useState(12);
  const [extender, setExtender] = useState(null);
  const [diasExtra, setDiasExtra] = useState('');
  const [cerrar, setCerrar] = useState(null);
  const [busy, setBusy] = useState(false);

  const cuenta = useMemo(() => {
    const c = { TODAS: items.length, CUBIERTA: 0, RESUELTA: 0 };
    items.forEach((n) => { c[n.estado] = (c[n.estado] || 0) + 1; });
    return c;
  }, [items]);
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return items.filter((n) => (estado === 'TODAS' || n.estado === estado)
      && (!t || [n.id, n.cajero, n.oficina, n.descripcion, n.backup, n.reportadoPor].some((x) => norm(x || '').includes(t))));
  }, [items, estado, q]);

  async function accion(datos, ok) {
    setBusy(true);
    try {
      const res = await gas('procesarAccionNovedad', datos);
      toast(res.msg);
      if (res.success) { ok(); onChange(); }
    } catch (e) { toast('❌ ' + e.message); } finally { setBusy(false); }
  }
  const diasNum = parseInt(diasExtra, 10);

  return (
    <Panel icon="clock" title="Historial de novedades atendidas"
      sub={esAdmin ? 'Vista ADMIN: todas las novedades cubiertas y resueltas.' : 'Solo las novedades que usted registró (como en V1).'}
      right={<Seg value={estado} onChange={(k) => { setEstado(k); setLimite(12); }} items={[['TODAS', 'Todas', cuenta.TODAS], ['CUBIERTA', 'Cubiertas', cuenta.CUBIERTA], ['RESUELTA', 'Resueltas', cuenta.RESUELTA]]} />}>
      <div className="v1p-toolbar">
        <div className="v1p-search grow"><Icon name="search" /><input className="inp" placeholder="Buscar por ID, funcionario, oficina, motivo o backup" value={q} onChange={(e) => { setQ(e.target.value); setLimite(12); }} /></div>
        <span className="v1p-counter"><b className="num">{fmt(lista.length)}</b> registros</span>
      </div>
      {!lista.length ? <Empty icon="list" title="📋 No hay solicitudes atendidas en seguimiento activo.">{q ? 'Ninguna coincide con la búsqueda.' : 'Cuando un backup cubra una baja aparecerá aquí.'}</Empty> : (
        <ul className="v1p-hist">
          {lista.slice(0, limite).map((n) => {
            const open = abierto === n.id;
            const cub = n.estado === 'CUBIERTA';
            return (
              <li key={n.id} className={(open ? 'open ' : '') + (cub ? 'cub' : 'res')}>
                <button type="button" className="v1p-hist-row" onClick={() => setAbierto(open ? null : n.id)} aria-expanded={open}>
                  <span className={'v1p-hist-ic ' + (cub ? 'cub' : 'res')}><PIcon name={cub ? 'hourglass' : 'check'} /></span>
                  <span className="v1p-hist-main">
                    <b className="ellip">{n.cajero}</b>
                    <span className="ellip muted">{n.oficina}</span>
                  </span>
                  <span className="v1p-hist-bk"><span className="v1p-k">Backup</span><b className="ellip">{n.backup}</b></span>
                  <span className="v1p-hist-d"><span className="v1p-k">Inicio · días</span><b className="num">{n.fechaInicio ? n.fechaInicio.slice(0, 10) : '—'} · {n.diasAusencia}</b></span>
                  <span className="v1p-hist-st"><Pill v={n.estado} />{cub && <Progreso n={n} />}</span>
                  <Icon name="down" className="v1p-hist-chev" />
                </button>
                {open && (
                  <div className="v1p-hist-detail">
                    <Timeline n={n} />
                    <div className="v1p-hist-side">
                      <dl>
                        <dt>ID</dt><dd className="num">{n.id}</dd>
                        <dt>Motivo</dt><dd>{n.descripcion}</dd>
                        <dt>Reportó</dt><dd>{n.reportadoPor || '—'}</dd>
                        {n.adminNombre && <><dt>Cerró</dt><dd>{n.adminNombre}</dd></>}
                      </dl>
                      {cub ? (
                        <div className="v1p-hist-act">
                          <button type="button" className="btn v1p-btn-gold" onClick={() => { setExtender(n); setDiasExtra(''); }}><PIcon name="calendar" />Extender</button>
                          <button type="button" className="btn btn-p" onClick={() => setCerrar(n)}><Icon name="check" />Cerrar</button>
                        </div>
                      ) : <span className="v1p-locked-t"><Icon name="lock" />Resuelta</span>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {lista.length > limite && <button type="button" className="btn btn-g v1p-more" onClick={() => setLimite((l) => l + 12)}>Ver más ({fmt(lista.length - limite)})<Icon name="down" /></button>}

      {extender && (
        <Modal title="Extender novedad" icon="calendar" onClose={() => !busy && setExtender(null)}
          foot={<>
            <button type="button" className="btn btn-o" onClick={() => setExtender(null)} disabled={busy}>Cancelar</button>
            <button type="button" className={'btn btn-p' + (busy ? ' loading' : '')} disabled={busy || !(diasNum > 0)}
              onClick={() => accion({ id: extender.id, accion: 'EXTENDER', dias: diasNum }, () => setExtender(null))}><span className="spinner" />Extender {diasNum > 0 ? diasNum + (diasNum === 1 ? ' día' : ' días') : ''}</button>
          </>}>
          <p className="v1p-modal-lead">¿Cuántos días adicionales deseas sumarle a la ausencia de <b>{extender.cajero}</b>? Hoy suma <b>{extender.diasAusencia}</b> {extender.diasAusencia === '1' ? 'día' : 'días'}; {extender.backup} sigue cubriendo.</p>
          <F label="Días adicionales" req error={diasExtra !== '' && !(diasNum > 0) ? '⚠️ Por favor ingresa un número de días válido.' : null}>
            <input className="inp num" type="number" min="1" value={diasExtra} onChange={(e) => setDiasExtra(e.target.value)} placeholder="Ej: 2" autoFocus />
          </F>
          <div className="v1p-quick">{[1, 2, 3, 5, 7, 15].map((d) => <button key={d} type="button" className={'v1p-chip-t' + (diasNum === d ? ' on' : '')} onClick={() => setDiasExtra(String(d))}>+{d}</button>)}</div>
        </Modal>
      )}
      {cerrar && (
        <Modal title="Cerrar novedad" icon="check" onClose={() => !busy && setCerrar(null)}
          foot={<>
            <button type="button" className="btn btn-o" onClick={() => setCerrar(null)} disabled={busy}>Cancelar</button>
            <button type="button" className={'btn btn-p' + (busy ? ' loading' : '')} disabled={busy}
              onClick={() => accion({ id: cerrar.id, accion: 'CERRAR', adminNombre: sesion.nombre }, () => setCerrar(null))}><span className="spinner" /><Icon name="check" />Cerrar novedad</button>
          </>}>
          <p className="v1p-modal-lead">¿Estás seguro de que deseas <b>CERRAR</b> la novedad de <b>{cerrar.cajero}</b>? El backup <b>{cerrar.backup}</b> volverá a estar disponible.</p>
          <ul className="v1p-checks">
            <li><Icon name="check" /><span>Estado → <b>RESUELTA</b>, con fecha de resolución de hoy.</span></li>
            <li><Icon name="check" /><span>Cierre registrado a nombre de <b>{sesion.nombre}</b>.</span></li>
            <li><Icon name="check" /><span>{cerrar.backup} vuelve a BACKUP = <b>SI</b>.</span></li>
          </ul>
        </Modal>
      )}
    </Panel>
  );
}
