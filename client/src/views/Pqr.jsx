// N3 PQR y experiencia: hub único de PQR. Pestañas en la URL (/pqr/radicacion, /pqr/seguimiento):
//  · Radicación y libro de PQR → formulario real de COI V1 (Experiencia de Cliente, libro PQR en Sheets).
//  · Seguimiento, reclamaciones y encuestas → tablero de gestión (demostración del catálogo).
import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Kpis, Card, Table, Cell, Tabs, Tag, Bar, Avatar, HBars } from '../components/ui.jsx';
import { ModalBtn } from '../components/Overlays.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, pct } from '../lib/format.js';
import { gas } from '../lib/gas.js';
import { ModuleData, ToastBtn, Small, Mt } from './operacion/common.jsx';
import Experiencia from './coiv1/Experiencia.jsx';
import { SourceBadge, useMeta } from './hub/LiveOps.jsx';
import './hub/hub.css';

const TABS = [
  ['radicacion', 'Radicación y libro de PQR', 'form', 'Real'],
  ['seguimiento', 'Seguimiento, reclamaciones y encuestas', 'flow', 'Demo']
];
// Cifras del libro PQR: se conservan entre pestañas (cada pestaña es una ruta).
const STATS = { v: null };

function usePqrStats() {
  const [st, setSt] = useState(STATS.v);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let vivo = true;
    gas('obtenerHistorialPQR', '', 'ADMIN').then((h) => {
      const lista = Array.isArray(h) ? h : [];
      const hace30 = Date.now() - 30 * 86400000;
      const v = {
        total: lista.length,
        mes: lista.filter((r) => Date.parse(r.fechaRadicacionISO) >= hace30).length,
        qr: lista.filter((r) => r.tipificacion === 'Queja' || r.tipificacion === 'Reclamo').length
      };
      STATS.v = v; if (vivo) setSt(v);
    }).catch((e) => vivo && setErr(e));
    return () => { vivo = false; };
  }, []);
  return [st, err];
}

export default function Pqr({ sub }) {
  const { go } = useApp();
  const meta = useMeta();
  const [st, err] = usePqrStats();
  const tab = TABS.some((t) => t[0] === sub) ? sub : 'radicacion';
  const k = (label, v, small) => (
    <div className="hub-pqr-k"><span>{label}</span>{v == null ? (err ? <b>—</b> : <i className="hub-sk" />) : <b className="num">{fmt(v)}</b>}{small && <small>{small}</small>}</div>
  );
  return (
    <div className="hub-pqr">
      <section className="hub-pqr-head">
        <div>
          <div className="hub-pqr-eyebrow">Operación · N3</div>
          <h1>PQR y experiencia</h1>
          <p>Un solo lugar para radicar peticiones, quejas y reclamos con constancia, consultar el libro PQR y hacer seguimiento a reclamaciones, casos jurídicos y encuestas de satisfacción.</p>
          <SourceBadge meta={meta} compact />
        </div>
        <div className="hub-pqr-kpis" aria-label="Cifras del libro PQR">
          {k('Radicadas', st && st.total)}
          {k('Últimos 30 días', st && st.mes)}
          {k('Quejas y reclamos', st && st.qr)}
        </div>
        <div className="hub-pqr-meta">
          <div className="hub-tabs" role="tablist" aria-label="Secciones de PQR">
            {TABS.map(([id, label, icon, tag]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={'hub-tab' + (tab === id ? ' on' : '')}
                onClick={() => tab !== id && go('pqr/' + id, { keepScroll: true })}>
                <Icon name={icon} />{label}<small className={tag === 'Real' ? 'real' : 'demo'}>{tag === 'Real' ? 'Datos reales' : 'Demostración'}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="hub-pqr-body" role="tabpanel">
        {tab === 'radicacion'
          ? <div className="hub-embed"><Experiencia /></div>
          : <ModuleData view="pqr">{(d) => <Body d={d} />}</ModuleData>}
      </div>
    </div>
  );
}

function Body({ d }) {
  const { modal } = useApp();
  const PQR = d.pqr;

  const open = (x) => modal({
    title: x[0] + ', ' + x[1],
    body: <div className="timeline-v">
      <div className="it cur"><div className="strong">Radicada por código QR</div><div className="small muted">{x[2]}</div></div>
      <div className={'it ' + (x[4] ? 'cur' : '')}><div className="strong">Ampliación de información</div><div className="small muted">{x[4]} de 3 permitidas</div></div>
      <div className={'it ' + (/líder|video/.test(x[3]) ? 'cur' : '')}><div className="strong">Respuesta del líder</div><div className="small muted">Solicitada por el sistema</div></div>
      <div className="it"><div className="strong">Respuesta al cliente</div><div className="small muted">{x[5]} días hábiles restantes</div></div>
    </div>,
    foot: <>
      <ModalBtn className="btn btn-o" done="Caso escalado a Jurídica.">Escalar a Jurídica</ModalBtn>
      <ModalBtn done="Ampliación de información solicitada.">Pedir ampliación</ModalBtn>
    </>
  });

  const rows = PQR.map((x) => ({
    key: x[0], onClick: () => open(x),
    cells: [
      <span className="num strong">{x[0]}</span>,
      <Cell main={x[1]} sub={x[2]} />,
      <Small>{x[3]}</Small>,
      <span className="num">{x[4]} de 3</span>,
      <div style={{ width: 170 }}><Bar v={(15 - x[5]) / 15 * 100} cls={x[5] < 6 ? 'gd' : 'cy'} /><div className="small muted" style={{ marginTop: 4 }}>{x[5]} días hábiles restantes</div></div>,
      <Avatar id={x[6]} />
    ]
  }));

  return (
    <>
      <div className="hub-pqr-intro">
        <p><span className="hub-tag demo">Demostración</span> Ampliaciones controladas, respuesta del líder, escalamiento a Jurídica y encuestas, con el reporte del día 1 generado automáticamente.</p>
        <ToastBtn className="btn btn-o" msg="Reporte de PQR del mes generado." icon="download">Reporte del mes</ToastBtn>
      </div>
      <Kpis items={[
        ['PQR abiertas', PQR.length, 'ninguna vencida', 'message'],
        ['Tiempo medio de respuesta', '4,1', 'días hábiles', 'clock', 'd'],
        ['Encuestas del mes', fmt(642), 'con líder y gerente regional asignados', 'list'],
        ['Satisfacción en encuestas', '91,4 %', <><span className="up">+2,1</span> frente al mes anterior</>, 'star']
      ]} />
      <Mt>
        <Tabs items={[
          ['PQR en gestión', <Card flush title="Casos en gestión" sub="Seleccione un caso para ver su trazabilidad">
            <Table headers={['Radicado', 'Asunto', 'Etapa', 'Ampliaciones', 'Plazo', 'Responsable']} rows={rows} />
          </Card>],
          ['Derechos de petición y tutelas', <Card flush title="Casos remitidos a Jurídica" sub="Plazo legal de 15 días hábiles para derechos de petición">
            <Table headers={['Radicado', 'Asunto', 'Días restantes', 'Estado']} rows={d.jur.map((j) => [
              <Cell main={j[0]} />, <Cell main={j[1]} sub={j[2]} />,
              <span className={'num ' + (j[3] < 5 ? 'down' : '')}>{j[3]} días</span>,
              <Tag cls="b-info">{j[4]}</Tag>
            ])} />
          </Card>],
          ['Encuestas', <div className="grid g2">
            <Card title="Satisfacción por regional" sub="Encuestas del mes, descargadas del aplicativo de Tecnología">
              <HBars rows={d.enc.map((e) => [e[0], e[1], pct(e[1], 1)])} color="nv" min={85} />
            </Card>
            <Card flush title="Calidad de los datos" sub="Antes de consolidar">
              <Table headers={['Control', 'Resultado']} rows={d.calidad.map((c) => [<Cell main={c[0]} />, <Tag cls={c[2]}>{c[1]}</Tag>])} />
            </Card>
          </div>]
        ]} />
      </Mt>
    </>
  );
}
