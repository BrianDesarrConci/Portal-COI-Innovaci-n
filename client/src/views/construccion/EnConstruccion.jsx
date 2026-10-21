// Opción del menú cuyo módulo aún no se ha entregado. No muestra datos simulados: describe el alcance
// con el catálogo real del área (actividades, responsables y clientes) y deja los contadores en cero.
import Icon from '../../components/Icon.jsx';
import { Avatar, Card, Cell, Kpis, Table, Tag } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { EN_DESARROLLO, PENDIENTES } from '../../lib/estados.js';
import './construccion.css';

export function EnConstruccion({ clave }) {
  const { acts, clients, procName } = useApp();
  const p = PENDIENTES[clave];
  const dev = EN_DESARROLLO[clave];
  const lista = acts.filter((a) => a.m === p.codigo);
  const responsables = [...new Set(lista.map((a) => a.a))];
  const atendidos = [...new Set(lista.flatMap((a) => a.c))].filter((k) => clients[k]);
  return (
    <div className="obra">
      <section className="obra-hero">
        <div className="obra-ic"><Icon name={p.icono} /></div>
        <div className="obra-t">
          <div className="obra-eyebrow">{p.grupo} · {p.codigo}</div>
          <h1>{p.nombre}</h1>
          <p>{p.descripcion}</p>
        </div>
        <div className={'obra-estado ' + (dev ? 'dev' : '')}>
          <span className="obra-cinta" aria-hidden="true" />
          <div>
            <b>{dev ? 'En desarrollo' : 'En construcción'}</b>
            <small>{dev
              ? [dev.analista && 'Responsable: ' + dev.analista, dev.entrega && 'Entrega: ' + dev.entrega].filter(Boolean).join(' · ') || 'Un analista del equipo lo está construyendo.'
              : 'Lo desarrolla un analista del equipo y se integra a COI al recibir su entrega.'}</small>
          </div>
        </div>
      </section>

      <Kpis items={[
        ['Registros en el módulo', 0, 'Se alimenta cuando el módulo entre en operación', 'inbox'],
        ['Actividades que cubrirá', lista.length, 'Del catálogo de Apoyo al Negocio', 'list'],
        ['Clientes atendidos', atendidos.length, atendidos.length ? atendidos.slice(0, 3).map((k) => clients[k].name).join(', ') + (atendidos.length > 3 ? ' y ' + (atendidos.length - 3) + ' más' : '') : 'Uso interno', 'building'],
        ['Analistas responsables', responsables.length, 'Según el catálogo de actividades', 'users'],
      ]} />

      <div className="mt">
        <Card title="Alcance del módulo" sub="Actividades del catálogo que este módulo va a soportar" flush>
          {lista.length
            ? <Table headers={['N.º', 'Actividad', 'Frecuencia', 'Responsable', 'Proceso', 'Hoy']}
                rows={lista.map((a) => ({ key: a.n, cells: [
                  <span className="num muted">{a.n}</span>, <Cell main={a.d} sub={a.cl} />, <span className="small">{a.f}</span>,
                  <Avatar id={a.a} />, <span className="small">{procName(a.p)}</span>, <Tag>Sin registro</Tag>
                ] }))} />
            : <p className="obra-vacio">Este módulo no tiene actividades asignadas en el catálogo.</p>}
        </Card>
      </div>
      <p className="obra-nota small muted"><Icon name="shield" />Sin datos de demostración: las cifras aparecen cuando el módulo se integre y empiece a registrar su operación.</p>
    </div>
  );
}

/** Vista para la ruta /<clave>. */
export function crearEnConstruccion(clave) {
  const Vista = () => <EnConstruccion clave={clave} />;
  Vista.displayName = 'EnConstruccion(' + clave + ')';
  return Vista;
}

