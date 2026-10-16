// G4 Cheques, arqueos y valores.
import { PageHead, Kpis, Card, Table, Cell, Tabs, HBars, DocRow, GasFrame, Tag, Bar, Loading } from '../components/ui.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt } from '../lib/format.js';
import { N, Small, ToastBtn } from './cifras/common.jsx';

export default function Cheques() {
  const { data: d, error } = useModuleData('cheques');
  if (!d) return <Loading error={error} />;
  const kpis = d.kpis.map((k) => (typeof k[1] === 'number' && k[1] >= 1000 ? [k[0], fmt(k[1]), ...k.slice(2)] : k));
  return (
    <>
      <PageHead title="Cheques, arqueos y valores" code="G4"
        sub="Inventario y custodia de cheques por consecutivo, consolidado de arqueos descargado desde COI, órdenes de no pago y proyección de temporada."
        right={<ToastBtn className="btn btn-o" msg="Consolidado de arqueos descargado desde COI." icon="download">Consolidado desde COI</ToastBtn>} />
      <Kpis items={kpis} />
      <div className="mt">
        <GasFrame code="G4" name="cheques y arqueos">
          <Tabs items={[
            ['Inventario', (
              <Card title="Inventario de cheques por ubicación" sub="Años de cobertura según el consumo actual; seguridad no permite traslados entre municipios" flush>
                <Table headers={['Ubicación', 'Cheques', 'Cobertura', '']} align={['', 'r', 'r', '']}
                  rows={d.inventario.map((i) => [<Cell main={i[0]} />, <N>{fmt(i[1])}</N>, <N>{fmt(i[2], 1)} años</N>, i[2] > 5 ? <Tag cls="b-warn">Sobrestock</Tag> : <Tag cls="b-ok">Adecuado</Tag>])} />
              </Card>
            )],
            ['Proyección de temporada', (
              <div className="grid g2">
                <Card title="Cálculo de la solicitud" sub="Proyección recibida contra inventario disponible" flush>
                  <Table headers={['Concepto', 'Cheques']} align={['', 'r']} rows={d.proyeccion.map((p) => [<Cell main={p[0]} />, <N strong={p[2]}>{p[1]}</N>])} />
                </Card>
                <Card title="Recomendación">
                  <p className="small" style={{ lineHeight: 1.6 }}>{d.recomendacion}</p>
                  <div style={{ marginTop: 14 }}>
                    <ToastBtn className="btn btn-p btn-sm" msg="Correo de arqueo y propuesta de distribución enviado para aprobación." icon="send">Enviar para aprobación</ToastBtn>
                  </div>
                </Card>
              </div>
            )],
            ['Consolidado de arqueos', (
              <Card title="Consolidado de arqueos del mes" sub="Descargado desde COI, sin macros" flush>
                <Table headers={['Cliente', 'Oficinas', 'Arqueos', 'Resultado']} align={['', 'r', 'r', '']}
                  rows={d.arqueos.map((a) => [<Cell main={a[0]} />, <N>{a[1]}</N>, <N>{a[2]}</N>, <Tag cls={a[3] === 'Sin diferencias' ? 'b-ok' : 'b-info'}>{a[3]}</Tag>])} />
              </Card>
            )],
            ['Órdenes de no pago', (
              <Card title="Órdenes de no pago" sub="La oficina envía el cheque perforado con sellos de anulación y carta explicativa" flush>
                <Table headers={['Radicado', 'Cliente', 'Motivo', 'Estado']}
                  rows={d.noPago.map((o) => [<Cell main={o[0]} />, o[1], <Small>{o[2]}</Small>, <Tag cls={o[4]}>{o[3]}</Tag>])} />
              </Card>
            )],
            ['Zunchos y BO de cheques', (
              <div className="grid g2">
                <Card title="Solicitudes de cheques y zunchos" sub="Porvenir y Citibank; entrega con arqueo de cofre" flush>
                  <Table headers={['Solicitud', 'Cliente', 'Cantidad', 'Estado']}
                    rows={d.zunchos.map((r) => [<Cell main={r[0]} />, r[1], <N>{r[2]}</N>, <Tag cls={r[3].indexOf('Arqueo') === 0 ? 'b-ok' : 'b-info'}>{r[3]}</Tag>])} />
                </Card>
                <Card title="BO de cheques" sub="Datos leídos con inteligencia artificial e ingresados al sistema"><HBars rows={d.bo} color="nv" /></Card>
              </div>
            )],
            ['Custodia y Control Interno', (
              <div className="grid g2">
                <Card title="Cofre de custodia" sub="Capacidad usada">
                  <div className="big-num">{d.cofre.uso} %</div>
                  <div className="small muted" style={{ margin: '6px 0 12px' }}>{d.cofre.nota}</div>
                  <Bar v={d.cofre.uso} cls="gd" />
                </Card>
                <Card title="Arqueo de Control Interno">
                  <DocRow title={d.controlInterno[0]} sub={d.controlInterno[1]} icon="shield" right={<Tag cls="b-ok">Conforme</Tag>} />
                </Card>
              </div>
            )],
          ]} />
        </GasFrame>
      </div>
    </>
  );
}
