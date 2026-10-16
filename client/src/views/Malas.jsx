// G1 Malas prácticas y fraccionamientos.
import { PageHead, Kpis, Card, Table, Cell, LineChart, GasFrame, Tag, Loading } from '../components/ui.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { Small, ToastBtn } from './cifras/common.jsx';

const ESTADO_CLS = { Respondido: 'b-ok', Enviado: 'b-mute' };

export default function Malas() {
  const { data: d, error } = useModuleData('malas');
  if (!d) return <Loading error={error} />;
  const rows = d.casos.map((c) => [
    <Cell main={c[0]} />, <Tag cls={c[1] === 'Fraccionamiento' ? 'b-warn' : 'b-info'}>{c[1]}</Tag>,
    <Small>{c[2]}</Small>, <Small>{c[3]}</Small>, <Tag cls={ESTADO_CLS[c[4]] || 'b-info'}>{c[4]}</Tag>,
  ]);
  const frac = d.casos.filter((c) => c[1] === 'Fraccionamiento').length;
  const fracTxt = (n) => n + (n === 1 ? ' fraccionamiento' : ' fraccionamientos');
  const malTxt = (n) => n + (n === 1 ? ' mala práctica' : ' malas prácticas');
  return (
    <>
      <PageHead title="Malas prácticas y fraccionamientos" code="G1"
        sub="Registro semanal de casos y envío automático a cada líder los viernes; las reclamaciones de Bancolombia se controlan con su plazo de 5 días hábiles."
        right={<ToastBtn className="btn btn-p" msg="Consolidado enviado a los 6 líderes de zona." icon="send">Enviar a los líderes</ToastBtn>} />
      <Kpis items={[['Casos de la semana', d.casos.length, fracTxt(frac) + ', ' + malTxt(d.casos.length - frac), 'alert'], ...d.kpis]} />
      <div className="mt">
        <GasFrame code="G1" name="malas prácticas">
          <div className="grid g-main">
            <Card title="Casos de la semana" sub="Se agrupan por líder en un solo envío" flush>
              <Table headers={['Oficina', 'Tipo', 'Detalle', 'Líder', 'Estado']} rows={rows} />
            </Card>
            <Card title="Tendencia semanal" sub="Casos registrados">
              <LineChart series={[{ data: d.tendencia.data, color: '#242A54', area: true }]} labels={d.tendencia.weeks} min={0} max={10} label="Tendencia" h={220} w={480} />
            </Card>
          </div>
        </GasFrame>
      </div>
    </>
  );
}
