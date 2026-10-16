// Ayudantes compartidos por las vistas de Cifras (N5, N6, N9) y Módulos Apps Script (G1…G6).
import Icon from '../../components/Icon.jsx';
import { ModalBtn } from '../../components/Overlays.jsx';
import { useApp } from '../../context/AppContext.jsx';

/** Botón que muestra un aviso (equivale a data-act="toast" data-k="…"). */
export function ToastBtn({ msg, icon, className = 'btn btn-o btn-sm', children }) {
  const { toast } = useApp();
  return <button type="button" className={className} onClick={() => toast(msg)}>{icon && <Icon name={icon} />}{children}</button>;
}

export const Small = ({ children }) => <span className="small">{children}</span>;
export const N = ({ children, strong }) => <span className={'num' + (strong ? ' strong' : '')}>{children}</span>;

/**
 * Tabla sin navegación para contenido de modales: el modal se monta fuera de
 * AppProvider, así que ahí no puede usarse <Table> (depende de useApp().go).
 */
export function StaticTable({ headers, rows, align = [] }) {
  return (
    <table className="t">
      <thead><tr>{headers.map((h, i) => <th key={i} className={align[i] || ''}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i} className={align[i] || ''} data-label={headers[i]}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** Acción "acta": abre el acta de comité de un cliente con las cifras del periodo anterior. */
export function useActa(acta) {
  const { modal, PREV_MONTH } = useApp();
  return (cliente) => modal({
    title: 'Acta de comité, ' + cliente,
    body: (
      <div className="paper">
        <h4>Acta de comité de seguimiento</h4>
        <div className="small muted" style={{ marginBottom: 12 }}>{cliente} y Reval S.A.S. Periodo: {PREV_MONTH}.</div>
        <StaticTable headers={['Indicador', 'Meta', 'Resultado']} align={['', 'r', 'r']}
          rows={acta.indicadores.map((r) => [r[0], <N>{r[1]}</N>, <N strong>{r[2]}</N>])} />
        <p className="small" style={{ marginTop: 12 }}><b>Compromisos:</b> {acta.compromisos}</p>
        <p className="small muted" style={{ marginTop: 8 }}>Cifras generadas desde la bitácora de COI.</p>
      </div>
    ),
    foot: (
      <>
        <ModalBtn className="btn btn-o">Cerrar</ModalBtn>
        <ModalBtn className="btn btn-p" done="Acta descargada en PDF."><Icon name="download" />Descargar PDF</ModalBtn>
      </>
    ),
  });
}
