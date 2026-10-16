// G6 Correo de ingresos.
import { PageHead, Kpis, Card, Table, Cell, GasFrame, Tag, Loading } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { MONTHS } from '../lib/format.js';
import { N, Small, ToastBtn } from './cifras/common.jsx';

export default function Ingresos() {
  const { NOW } = useApp();
  const { data: d, error } = useModuleData('ingresos');
  if (!d) return <Loading error={error} />;
  const m0 = MONTHS[NOW.getMonth()], m1 = MONTHS[(NOW.getMonth() + 1) % 12];
  const pv = d.preview;
  return (
    <>
      <PageHead title="Correo de ingresos" code="G6"
        sub="Correo mensual por oficina con el personal autorizado, generado desde la planta vigente; reemplaza el flujo manual de Workspace Studio."
        right={<ToastBtn className="btn btn-p" msg="118 correos de ingresos programados." icon="send">Programar envío</ToastBtn>} />
      <Kpis items={d.kpis} />
      <div className="mt">
        <GasFrame code="G6" name="correo de ingresos">
          <div className="grid g2">
            <Card title="Lotes del periodo" flush>
              <Table headers={['Destino', 'Correos', 'Tipos de personal', 'Estado']} align={['', 'r', '', '']}
                rows={d.lotes.map((l) => [<Cell main={l[0]} />, <N>{l[1]}</N>, <Small>{l[2]}</Small>, <Tag cls={l[3] === 'Enviado' ? 'b-ok' : 'b-info'}>{l[3]}</Tag>])} />
            </Card>
            <Card title="Vista previa" sub={pv.oficina}>
              <div className="paper">
                <div className="small muted">Para: {pv.para}</div>
                <div className="small muted" style={{ marginBottom: 12 }}>Asunto: Ingresos autorizados {m0} a {m1}, oficina Salitre</div>
                <p style={{ marginBottom: 10 }}>Buen día. Relacionamos el personal de Reval autorizado para ingresar a la oficina entre el 15 de {m0} y el 15 de {m1}:</p>
                <Table headers={['Nombre', 'Cargo']} rows={pv.personal.map((x) => [x[0], <Small>{x[1]}</Small>])} />
                <p style={{ marginTop: 10 }} className="small muted">Generado automáticamente por COI desde la planta vigente.</p>
              </div>
            </Card>
          </div>
        </GasFrame>
      </div>
    </>
  );
}
