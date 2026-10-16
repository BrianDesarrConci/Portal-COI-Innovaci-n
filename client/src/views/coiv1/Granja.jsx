// Granja de Usuarios (COI V1, sección "novedades"): bajas de personal, asignación de backups,
// historial con extender/cerrar y explorador del directorio. Lógica de js.html + Código.gs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt } from '../../lib/format.js';
import { V1Bar, V1Guard, useV1 } from './V1Session.jsx';
import { V1Hero, Stat, Seg, Panel, Bars, ErrorBox, Skeleton, PIcon, Avatar, toneOf, Pill, gas } from './portal/kit.jsx';
import { COL } from './portal/granjaLogic.js';
import Registro from './portal/granja/Registro.jsx';
import Pendientes from './portal/granja/Pendientes.jsx';
import Asignacion from './portal/granja/Asignacion.jsx';
import Historial from './portal/granja/Historial.jsx';
import Directorio from './portal/granja/Directorio.jsx';

export default function Granja() {
  return (<><V1Bar /><V1Guard modulo="novedades"><GranjaModulo /></V1Guard></>);
}

function GranjaModulo() {
  const { sesion } = useV1();
  const { toast } = useApp();
  const [tab, setTab] = useState('gestion');
  const [lista, setLista] = useState(null);
  const [backups, setBackups] = useState(null);
  const [pend, setPend] = useState(null);
  const [hist, setHist] = useState(null);
  const [auto, setAuto] = useState(null);
  const [error, setError] = useState(null);
  const [gestion, setGestion] = useState(null);
  const asigRef = useRef(null);
  const esAdmin = String(sesion.rol || '').trim().toUpperCase() === 'ADMIN';

  const cargarNovedades = useCallback(async () => {
    const [p, h, b] = await Promise.all([
      gas('obtenerNovedadesPendientes', sesion.nombre, sesion.rol),
      gas('obtenerHistorialCompletoBackend', sesion.nombre, sesion.rol),
      gas('obtenerCajerosBackup')
    ]);
    setPend(p); setHist(h); setBackups(b);
  }, [sesion.nombre, sesion.rol]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      // En V1 corre con un activador diario; aquí al abrir el módulo.
      const a = await gas('cerrarNovedadesAutomaticamente');
      setAuto({ ...a, at: new Date() });
      if (a && a.cerradas > 0) toast(a.msg);
      const [l] = await Promise.all([gas('obtenerListaCajeros'), cargarNovedades()]);
      setLista(Array.isArray(l) ? l : []);
    } catch (e) { setError(e); }
  }, [cargarNovedades, toast]);

  useEffect(() => { setGestion(null); cargar(); }, [cargar]);

  const gestionar = (n) => {
    setGestion(n);
    setTimeout(() => asigRef.current && asigRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const cuenta = useMemo(() => {
    const c = { CUBIERTA: 0, RESUELTA: 0 };
    (hist || []).forEach((n) => { c[n.estado] = (c[n.estado] || 0) + 1; });
    return c;
  }, [hist]);
  const backupsZona = useMemo(() => {
    const m = new Map();
    (backups || []).forEach((f) => { const z = f[COL.ZONA] || 'Sin zona'; m.set(z, (m.get(z) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [backups]);
  const activas = useMemo(() => (hist || []).filter((n) => n.estado === 'CUBIERTA'), [hist]);
  const loading = !lista || !pend || !hist;

  return (
    <div className="v1p">
      <V1Hero eyebrow="COI V1 · Operación de red" icon="users" title="Granja de Usuarios"
        sub="Registra bajas de personal y asigna reemplazos desde un solo lugar: el directorio nacional de cajeros y su personal backup, conectado a la hoja Novedades."
        right={
          <div className="v1p-hero-card">
            <span className="v1p-k"><PIcon name="refresh" />Cierre automático</span>
            {auto ? <><b>{auto.cerradas || 0} {auto.cerradas === 1 ? 'cobertura vencida cerrada' : 'coberturas vencidas cerradas'}</b><small>Ejecutado {auto.at.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })} · SISTEMA AUTOMÁTICO</small></> : <small>Verificando coberturas vencidas…</small>}
          </div>
        }>
        <div className="v1p-hero-tabs">
          <Seg size="lg" value={tab} onChange={setTab} items={[['gestion', 'Gestión de bajas', pend ? pend.length : undefined], ['historial', 'Historial', hist ? hist.length : undefined], ['directorio', 'Directorio']]} />
        </div>
      </V1Hero>

      {error && <ErrorBox error={error} onRetry={cargar} />}

      <div className="v1p-stats">
        <Stat label="Bajas pendientes" value={pend ? pend.length : 0} loading={!pend} icon="alert" color="#D6453D" sub={esAdmin ? 'Todas las regionales' : 'Registradas por usted'} onClick={() => setTab('gestion')} />
        <Stat label="Coberturas activas" value={cuenta.CUBIERTA} loading={!hist} icon="hourglass" color="#21BBEA" sub="Estado CUBIERTA" onClick={() => setTab('historial')} />
        <Stat label="Novedades resueltas" value={cuenta.RESUELTA} loading={!hist} icon="check" color="#048C38" sub="Cerradas o vencidas" onClick={() => setTab('historial')} />
        <Stat label="Backups disponibles" value={backups ? backups.length : 0} loading={!backups} icon="usercheck" color="#C99A00" sub={backupsZona.length ? `En ${backupsZona.length} zonas` : 'BACKUP SI/NO = SI'} />
        <Stat label="Personas en la granja" value={lista ? lista.length : 0} loading={!lista} icon="users" color="#242A54" sub="Con sede georreferenciada" onClick={() => setTab('directorio')} />
      </div>

      {loading && !error ? <div className="v1p-two mt"><div className="card v1p-pad"><Skeleton rows={6} h={36} /></div><div className="card v1p-pad"><Skeleton rows={6} h={36} /></div></div> : !loading && (
        <>
          {tab === 'gestion' && (
            <>
              <div className="v1p-two mt">
                <Registro lista={lista} sesion={sesion} onDone={() => cargarNovedades()} />
                <Pendientes items={pend} activo={gestion && gestion.id} onGestionar={gestionar} esAdmin={esAdmin} />
              </div>
              <div ref={asigRef} className="v1p-anchor">
                {gestion && <div className="mt"><Asignacion gestion={gestion} lista={lista} sesion={sesion} onCancel={() => setGestion(null)} onAsignado={() => { setGestion(null); cargarNovedades(); }} /></div>}
              </div>
              <div className="v1p-two mt">
                <Panel icon="hourglass" title="Coberturas en curso" sub="Backups cubriendo una baja en este momento" right={<span className="v1p-count info num">{activas.length}</span>}>
                  {!activas.length ? <p className="muted small">No hay coberturas activas. Asigne un backup a una baja pendiente para iniciarla.</p> : (
                    <ul className="v1p-mini">
                      {activas.slice(0, 6).map((n) => (
                        <li key={n.id}>
                          <Avatar name={n.backup} tone={toneOf(n.backup)} size="sm" />
                          <span className="grow"><b className="ellip">{n.backup}</b><small className="ellip">cubre a {n.cajero} · {n.oficina}</small></span>
                          <span className="v1p-mini-r"><Pill v={n.estado} /><small className="muted num">hasta {n.fechaFin || '—'}</small></span>
                        </li>
                      ))}
                      {activas.length > 6 && <li className="v1p-mini-more"><button type="button" className="btn btn-g btn-sm" onClick={() => setTab('historial')}>Ver las {activas.length}<Icon name="chevron" /></button></li>}
                    </ul>
                  )}
                </Panel>
                <Panel icon="map" title="Backups disponibles por zona" sub={`${fmt(backups.length)} personas con BACKUP = SI`}>
                  <Bars rows={backupsZona.slice(0, 8).map(([z, n]) => [z, n])} color="var(--green)" />
                  {backupsZona.length > 8 && <p className="muted small mt8">y {backupsZona.length - 8} zonas más. Explórelas en el Directorio.</p>}
                </Panel>
              </div>
            </>
          )}
          {tab === 'historial' && <div className="mt"><Historial items={hist} sesion={sesion} esAdmin={esAdmin} onChange={cargarNovedades} /></div>}
          {tab === 'directorio' && <div className="mt"><Directorio lista={lista} /></div>}
        </>
      )}
    </div>
  );
}
