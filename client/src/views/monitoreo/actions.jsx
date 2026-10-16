// Acciones de Monitoreo (equivalen a ACTIONS del demo): ANS vigente, evaluación,
// evidencia, acta de comité, mensaje e informe del día.
// Nota: el contenido de los modales se pinta fuera del proveedor de la app, por eso
// aquí no se usan componentes que lean useApp() (Table, Avatar, GoLink).
import Icon from '../../components/Icon.jsx';
import { Cell, Field, Tag, areaStyle, fieldStyle } from '../../components/ui.jsx';
import { ModalBtn } from '../../components/Overlays.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { shortDate } from '../../lib/format.js';

function AnsDoc({ c, x }) {
  return (
    <div className="paper">
      <h4>Acuerdo de nivel de servicio</h4>
      <div className="small muted" style={{ marginBottom: 14 }}>{c.name} y Reval S.A.S. Versión {x.ans}, vigente desde el {shortDate(x.ansDate)}.</div>
      {x.clauses.map((cl, i) => (
        <div className="clause" key={i}>
          <span className="num muted">{i + 1}.</span>
          <div><div className="strong">{cl[0]}</div><div className="small muted">Plazo: {cl[1]}. Meta: {cl[2]}.</div></div>
          <Tag cls="b-ok">Medida en COI</Tag>
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 14 }}>Documento de demostración. En producción se muestra el PDF firmado cargado en el expediente.</p>
    </div>
  );
}

export function useMonitoreoActions() {
  const { D, acts, clients, AN, PREV_MONTH, modal, toast } = useApp();
  return {
    ans: (k) => modal({ title: 'ANS vigente de ' + clients[k].name, body: <AnsDoc c={clients[k]} x={D.clientExtra[k]} /> }),
    evaluacion: (k) => modal({
      title: 'Registrar evaluación del cliente',
      body: (
        <>
          <p className="muted" style={{ marginBottom: 14 }}>Cargue el formato de evaluación emitido por {clients[k].name}. La calificación queda en el expediente y en el tablero.</p>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Calificación de 1 a 5"><input type="number" min="1" max="5" step="0.1" defaultValue="4.6" style={{ ...fieldStyle, maxWidth: 160 }} /></Field>
            <Field label="Periodo"><select style={{ ...fieldStyle, maxWidth: 240 }}><option>{PREV_MONTH}</option></select></Field>
            <div className="drop"><Icon name="upload" /><div>Arrastre aquí el PDF de la evaluación</div></div>
          </div>
        </>
      ),
      foot: <><ModalBtn className="btn btn-o">Cancelar</ModalBtn><ModalBtn done="Evaluación registrada en el expediente.">Registrar evaluación</ModalBtn></>
    }),
    evidencia: (n) => {
      const x = acts.find((y) => y.n === +n);
      modal({
        title: 'Registrar evidencia',
        body: (
          <>
            <Cell main={x.d} sub={x.cl + ', ' + x.f} />
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <div className="drop"><Icon name="upload" /><div>Arrastre aquí el soporte (PDF, imagen o correo)</div></div>
              <Field label="Observación"><textarea rows="2" style={areaStyle} defaultValue="Actividad ejecutada dentro del plazo del ANS." /></Field>
            </div>
          </>
        ),
        foot: <><ModalBtn className="btn btn-o">Cancelar</ModalBtn><ModalBtn done="Evidencia registrada en la bitácora.">Registrar</ModalBtn></>
      });
    },
    /** Acta del último comité. `acta` llega del API (/api/modules/clientes). */
    acta: (name, acta) => modal({
      title: 'Acta de comité, ' + name,
      body: (
        <div className="paper">
          <h4>Acta de comité de seguimiento</h4>
          <div className="small muted" style={{ marginBottom: 12 }}>{name} y Reval S.A.S. Periodo: {PREV_MONTH}.</div>
          <table className="t">
            <thead><tr><th>Indicador</th><th className="r">Meta</th><th className="r">Resultado</th></tr></thead>
            <tbody>
              {acta.rows.map((r) => (
                <tr key={r[0]}>
                  <td data-label="Indicador">{r[0]}</td>
                  <td className="r" data-label="Meta"><span className="num">{r[1]}</span></td>
                  <td className="r" data-label="Resultado"><span className="num strong">{r[2]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small" style={{ marginTop: 12 }}><b>Compromisos:</b> {acta.commitments}</p>
          <p className="small muted" style={{ marginTop: 8 }}>Cifras generadas desde la bitácora de COI.</p>
        </div>
      ),
      foot: <><ModalBtn className="btn btn-o">Cerrar</ModalBtn><ModalBtn done="Acta descargada en PDF."><Icon name="download" />Descargar PDF</ModalBtn></>
    }),
    mensaje: (id) => toast('Mensaje enviado a ' + AN[id].name + '.'),
    informe: () => toast('Informe del día generado con ' + acts.length + ' actividades y sus evidencias.'),
  };
}
