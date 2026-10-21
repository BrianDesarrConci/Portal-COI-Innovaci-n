import { useState } from 'react';
import { Card, Cell, CLIENTES, Field, HBars, Icon, Kpis, Loading, PageHead, Table, areaStyle, fieldStyle, useOverlay, useRecurso } from '@coi/sdk';
import { ETQ, Estado, Prioridad, hace } from './comun.jsx';
import Detalle from './Detalle.jsx';
import './novedades-turno.css';

const FILTROS = [['activas', 'Activas'], ['abierta', 'Abiertas'], ['en_gestion', 'En gestión'], ['cerrada', 'Cerradas'], ['todas', 'Todas']];

/** Novedades de turno: tablero y bitácora de lo ocurrido en los turnos de las oficinas. */
export default function Modulo({ usuario, api }) {
  const { modal } = useOverlay();
  const [estado, setEstado] = useState('activas');
  const [q, setQ] = useState('');
  const resumen = useRecurso(api, '/resumen');
  const lista = useRecurso(api, `/novedades?estado=${estado}&q=${encodeURIComponent(q.trim())}`);
  const recargar = () => { resumen.reload(); lista.reload(); };

  if (!resumen.data) return <Loading error={resumen.error} />;
  const r = resumen.data;
  const nueva = () => modal({ title: 'Registrar novedad de turno', body: <NuevaNovedad api={api} onListo={recargar} /> });
  const abrir = (n) => modal({ title: n.cliente + (n.oficina ? ' · ' + n.oficina : ''), body: <Detalle api={api} id={n.id} usuario={usuario} onCambio={recargar} /> });

  return (
    <div className="novedades-turno">
      <PageHead title="Novedades de turno" sub="Lo que pasó en cada turno de las oficinas, quién lo atiende y cómo se cerró."
        right={<button className="btn btn-p" onClick={nueva}><Icon name="pen" />Registrar novedad</button>} />
      <Kpis items={[
        ['Abiertas', r.abiertas, 'Pendientes de gestión', 'inbox'],
        ['En gestión', r.en_gestion, 'Con responsable asignado', 'activity'],
        ['Prioridad alta', r.altas, 'Abiertas o en gestión', 'alert'],
        ['Cerradas hoy', r.cerradas_hoy, r.minutosCierre ? `Cierre promedio en ${r.minutosCierre} min` : 'Sin cierres aún', 'check'],
      ]} />
      <div className="grid g-main mt">
        <Card title="Bitácora de turnos" sub={lista.data ? `${lista.data.length} novedad${lista.data.length === 1 ? '' : 'es'}` : 'Cargando…'} flush
          right={<label className="novedades-turno-q"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, oficina o texto" aria-label="Buscar novedades" /></label>}>
          <div className="novedades-turno-seg" role="tablist" aria-label="Estado">
            {FILTROS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={estado === k} className={estado === k ? 'on' : ''} onClick={() => setEstado(k)}>{l}</button>)}
          </div>
          {lista.error ? <p className="novedades-turno-vacio">{lista.error.message}</p>
            : !lista.data ? <p className="novedades-turno-vacio">Cargando…</p>
            : !lista.data.length ? <p className="novedades-turno-vacio">No hay novedades con este filtro.</p>
            : <Table headers={['Novedad', 'Cliente y oficina', 'Prioridad', 'Estado', 'Registro']}
                rows={lista.data.map((n) => ({
                  key: n.id, onClick: () => abrir(n),
                  cells: [
                    <Cell key="n" main={<span className="novedades-turno-desc">{n.descripcion}</span>} sub={ETQ.categoria[n.categoria] + ' · turno ' + ETQ.turno[n.turno].toLowerCase()} />,
                    <Cell key="c" main={n.cliente} sub={n.oficina || 'Sin oficina'} />,
                    <Prioridad key="p" v={n.prioridad} />,
                    <Estado key="e" v={n.estado} />,
                    <span key="r" className="novedades-turno-reg"><Cell main={hace(n.creado_en)} sub={n.creado_por} /></span>,
                  ],
                }))} />}
        </Card>
        <div className="novedades-turno-lado">
          <Card title="Activas por categoría" sub="Abiertas y en gestión">
            {r.categorias.length ? <HBars rows={r.categorias.map((c) => [ETQ.categoria[c.categoria], c.total])} /> : <p className="muted small">Sin novedades activas.</p>}
          </Card>
          <Card title="Clientes con más novedades" sub="Activas, cinco principales">
            {r.clientes.length ? <HBars rows={r.clientes.map((c) => [c.cliente, c.total])} color="cy" /> : <p className="muted small">Sin novedades activas.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function NuevaNovedad({ api, onListo }) {
  const { closeModal } = useOverlay();
  const [f, setF] = useState({ turno: turnoActual(), cliente: '', oficina: '', categoria: 'operativa', prioridad: 'media', descripcion: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true); setError('');
    try { await api.post('/novedades', f); onListo(); closeModal('Novedad registrada.'); }
    catch (err) { setError(err.message); setEnviando(false); }
  };
  return (
    <form className="novedades-turno-form" onSubmit={enviar}>
      <div className="novedades-turno-fila">
        <Field label="Cliente">
          <select style={fieldStyle} value={f.cliente} onChange={set('cliente')} required>
            <option value="">Seleccione…</option>
            {CLIENTES.map((c) => <option key={c.key} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </Field>
        <Field label="Oficina"><input style={fieldStyle} value={f.oficina} onChange={set('oficina')} placeholder="Ej. BBVA Salitre" /></Field>
      </div>
      <div className="novedades-turno-fila tres">
        <Field label="Turno"><select style={fieldStyle} value={f.turno} onChange={set('turno')}>{Object.entries(ETQ.turno).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Categoría"><select style={fieldStyle} value={f.categoria} onChange={set('categoria')}>{Object.entries(ETQ.categoria).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Prioridad"><select style={fieldStyle} value={f.prioridad} onChange={set('prioridad')}>{Object.entries(ETQ.prioridad).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <Field label="Qué pasó"><textarea style={areaStyle} rows={4} value={f.descripcion} onChange={set('descripcion')} required minLength={10} placeholder="Describa la novedad, su impacto y lo que ya se hizo." /></Field>
      {error && <p className="novedades-turno-error" role="alert"><Icon name="alert" />{error}</p>}
      <div className="novedades-turno-acciones">
        <button type="button" className="btn btn-o" onClick={() => closeModal()}>Cancelar</button>
        <button className="btn btn-p" disabled={enviando}><Icon name="check" />{enviando ? 'Registrando…' : 'Registrar novedad'}</button>
      </div>
    </form>
  );
}

function turnoActual() {
  const h = new Date().getHours();
  return h >= 6 && h < 14 ? 'manana' : h >= 14 && h < 22 ? 'tarde' : 'noche';
}
