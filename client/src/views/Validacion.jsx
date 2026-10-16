// N1 Validación documental.
import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Kpis, Card, Table, Cell, Tabs, Tag, Bar } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { rng, pct, MONTHS } from '../lib/format.js';
import { ModuleData, ToastBtn, Small, Mt } from './operacion/common.jsx';

export default function Validacion() {
  return <ModuleData view="validacion">{(d) => <Body d={d} />}</ModuleData>;
}

function Body({ d }) {
  const { daySeed, NOW, toast, modal } = useApp();
  const [approved, setApproved] = useState({});

  const sop = useMemo(() => {
    const r = rng(daySeed ^ 77);
    return d.offices.map((o, i) => { const imgs = 1 + Math.floor(r() * 4); const okAll = r() > 0.1; return { o, imgs, failing: okAll ? -1 : Math.floor(r() * 4), man: i % 4 === 0 }; });
  }, [d, daySeed]);
  const pending = sop.filter((s) => s.failing >= 0);

  const aprobar = (key) => { setApproved((a) => ({ ...a, [key]: true })); toast('Aprobado y registrado en la bitácora.'); };
  const ver = () => modal({
    title: 'Soporte de cierre',
    body: <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[0, 1, 2].map((i) => <div key={i} className="thumb" style={{ width: '100%', height: 160 }} />)}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Imágenes de demostración. Verificación automática: fecha, orientación, completitud y oficina conformes.</p>
    </>
  });
  /** Celdas de resultado y acción; tras aprobar quedan como en el demo. */
  const decide = (key, needs, okTag, warnTag) => approved[key]
    ? [<Tag cls="b-ok">Aprobado por la analista</Tag>, <span className="small muted">Aprobado</span>]
    : [needs ? warnTag : okTag, needs ? <button className="btn btn-p btn-sm" onClick={() => aprobar(key)}>Aprobar</button> : null];

  const sopRows = sop.map((s, i) => {
    const [res, act] = decide('sop' + i, s.failing >= 0, <Tag cls="b-ok">Aprobado por el sistema</Tag>, <Tag cls="b-warn">Revisión humana</Tag>);
    return [
      <Cell main={s.o} sub={s.man ? 'Oficina manual, Excel de cuadre generado' : 'Cargue por Drive de contingencia'} />,
      <div style={{ display: 'flex', gap: 6 }}>{Array.from({ length: Math.min(s.imgs, 3) }, (_, k) => <span key={k} className="thumb" />)}</div>,
      <div className="checks">{d.checks.map((c, k) => <span key={c} className={'ck ' + (k === s.failing ? 'no' : '')}><Icon name={k === s.failing ? 'x' : 'check'} />{c}</span>)}</div>,
      res,
      s.failing >= 0 ? act : <button className="btn btn-g btn-sm" onClick={ver}>Ver</button>
    ];
  });
  const cRows = d.cartas.map((c) => [
    <Cell main={c[0]} sub={c[1]} />,
    <div style={{ width: 190 }}><Bar v={c[2] / 5 * 100} cls={c[2] >= 4 ? 'gd' : 'cy'} /><div className="small muted" style={{ marginTop: 4 }}>Día {c[2]} de 5 hábiles</div></div>,
    <Small>{c[3]}</Small>,
    c[2] >= 4 ? <Tag cls="b-warn">Vence pronto</Tag> : <Tag cls="b-info">En plazo</Tag>
  ]);
  const bRows = d.base1000.map((b) => [<Cell main={b[0]} />, <span className="num">{b[1]}</span>, <span className="num">{b[2]}</span>, <div style={{ width: 180 }}><Bar v={b[2] / b[1] * 100} cls={b[2] < b[1] ? 'gd' : ''} /></div>]);
  const dRows = d.decl.map((x, i) => {
    const [res, act] = decide('decl' + i, x[3] !== 'ok', <Tag cls="b-ok">Conforme</Tag>, <Tag cls="b-warn">Revisar {x[3]}</Tag>);
    return [<Cell main={x[0]} />, x[1], <span className="num">$ {x[2]}</span>, res, act];
  });
  const fRows = d.fotos.map((f) => [<Cell main={f[0]} />, <Small>{f[1]}</Small>, f[2] ? <Tag cls="b-ok">Completo</Tag> : <Tag cls="b-warn">Incompleto, se pidió al líder</Tag>]);

  return (
    <>
      <PageHead title="Validación documental" code="N1"
        sub="El sistema revisa cada soporte y documento antes de que llegue a la analista; solo los casos dudosos requieren revisión humana."
        right={<Tag cls="b-ok">Soportes BBVA completos a las 10:42 a. m.</Tag>} />
      <Kpis items={[
        ['Soportes BBVA recibidos hoy', sop.reduce((s, x) => s + x.imgs, 0), '31 oficinas, corte 11:00 a. m.', 'filecheck'],
        ['Aprobados sin intervención', pct((sop.length - pending.length) / sop.length * 100, 0), 'meta del plan: 70 %', 'sparkle'],
        ['Tiempo de revisión de Mónica', '1,2', 'antes de 1 a 3 horas diarias', 'clock', 'h'],
        ['Cartas de cesantías fuera de plazo', '0', '6 en curso dentro de los 5 días', 'shield']
      ]} />
      <Mt>
        <Tabs items={[
          ['Soportes BBVA', <Card flush title={'Soportes de apertura y cierre del ' + NOW.getDate() + ' de ' + MONTHS[NOW.getMonth()]} sub={'31 oficinas; ' + pending.length + ' requieren revisión humana'}
            right={<ToastBtn msg="Excel de cuadre de oficinas generado." icon="download">Excel de cuadre</ToastBtn>}>
            <Table headers={['Oficina', 'Imágenes', 'Verificación automática', 'Resultado', '']} rows={sopRows} align={['', '', '', '', 'r']} />
          </Card>],
          ['Cartas de cesantías', <Card flush title="Cartas en curso" sub="Ciclo de correos al empleador a primera hora, 10:00 a. m. y 2:00 p. m.; alertas en los días 2 y 5">
            <Table headers={['Empleador', 'Plazo', 'Último movimiento', 'Estado']} rows={cRows} />
          </Card>],
          ['Base 1000', <Card flush title="Base 1000 de novedades de cesantías" sub="Formulario de cajeros y líderes, cierre en PTR y consolidado a los líderes los viernes. Cerrar sin documento exige autorización de la jefatura."
            right={<ToastBtn msg="Consolidado de la base 1000 enviado a los líderes." icon="send">Enviar consolidado</ToastBtn>}>
            <Table headers={['Zona', 'Novedades', 'Cerradas', 'Avance']} rows={bRows} align={['', 'r', 'r', '']} />
          </Card>],
          ['Declaraciones Fincomercio', <Card flush title="Declaraciones de efectivo superiores a 5 millones" sub="Tomadas del buzón de Fincomercio y validadas por firma, huella, usuario del cajero, origen de fondos y cédula">
            <Table headers={['Declaración', 'Oficina', 'Valor', 'Validación', '']} rows={dRows} align={['', '', 'r', '', 'r']} />
          </Card>],
          ['Fotografías Banco Agrario', <Card flush title="Fotografías de validación" sub="Fachada, tarifario y vista interna de las oficinas Banco Agrario Más Cerca">
            <Table headers={['Oficina', 'Contenido', 'Resultado']} rows={fRows} />
          </Card>]
        ]} />
      </Mt>
    </>
  );
}
