// Pestaña "Radicar solicitud": formulario que crea la solicitud en el API y consulta de radicados por correo.
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Card } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { api } from '../../lib/api.js';
import { dshort, norm } from '../../lib/format.js';
import { TZ_APPS, TZ_TYPES, StateTag } from './shared.jsx';

const EMPTY = { req: 'Nubia Parrado', area: 'Gestión del Negocio', email: 'nubia.parrado@reval.com.co', app: TZ_APPS[0], type: TZ_TYPES[0], prio: 'Media', title: '', desc: '' };

export default function Radicar({ TZ, onCancel, onCreated }) {
  const { go, toast } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('jully@reval.com.co');
  const [lookup, setLookup] = useState('jully@reval.com.co');
  const mine = useMemo(() => TZ.filter((t) => norm(t.email) === norm(lookup.trim())), [TZ, lookup]);

  const bind = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const fld = (label, el, wide) => <label className={'fld' + (wide ? ' wide' : '')}><span>{label}</span>{el}</label>;
  const sl = (k, opts) => <select className="inp" {...bind(k)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;

  async function submit() {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const t = await api.post('/api/traza', form);
      toast('Solicitud ' + t.id + ' radicada. Se envió confirmación al correo del solicitante.');
      setForm(EMPTY);
      onCreated(t);
    } catch (e) {
      setErr(e.message); toast(e.message);
    } finally { setBusy(false); }
  }
  function consult() {
    const v = email.trim();
    setLookup(v);
    const found = TZ.filter((t) => norm(t.email) === norm(v));
    toast(found.length ? 'Se encontraron ' + found.length + ' radicados de ' + found[0].req + '.' : 'No se encontraron radicados para ' + v + '.');
  }

  return (
    <div className="grid g-main">
      <div className="card">
        <div className="card-h"><div><h3>Radicar una solicitud</h3><p>Cada solicitud recibe un radicado y se puede consultar en todo momento</p></div></div>
        <div className="card-b">
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {fld('Nombre completo', <input className="inp" {...bind('req')} />)}
            {fld('Área', <input className="inp" {...bind('area')} />)}
            {fld('Correo electrónico', <input className="inp" type="email" {...bind('email')} />)}
            {fld('Aplicativo', sl('app', TZ_APPS))}
            {fld('Tipo de solicitud', sl('type', TZ_TYPES))}
            {fld('Prioridad sugerida', sl('prio', ['Media', 'Alta', 'Baja', 'Crítica']))}
            {fld('Título', <input className="inp" placeholder="Ejemplo: tablero de transacciones por regional" {...bind('title')} />, true)}
            {fld('Descripción', <textarea className="inp" rows={4} placeholder="Qué necesita, para qué y quiénes lo usarán" {...bind('desc')} />, true)}
            <div className="fld wide"><span>Evidencia</span><div className="drop"><Icon name="upload" /><div>Arrastre aquí capturas o documentos de soporte</div></div></div>
          </form>
          {err && <p className="small down" role="alert" style={{ marginTop: 12 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="btn btn-o" onClick={onCancel}>Cancelar</button>
            <button className="btn btn-p" onClick={submit} disabled={busy}><Icon name="send" />{busy ? 'Radicando…' : 'Radicar solicitud'}</button>
          </div>
        </div>
      </div>
      <Card title="Consultar mis radicados" sub="Escriba el correo del solicitante">
        <form style={{ display: 'flex', gap: 8, marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); consult(); }}>
          <input className="inp" type="email" aria-label="Correo del solicitante" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-o" type="submit">Consultar</button>
        </form>
        {mine.map((t) => (
          <button key={t.id} className="rk-row" onClick={() => go('traza/' + t.id)}>
            <span className="grow"><b>{t.id}, {t.title}</b><small>{t.app}, radicada el {dshort(t.created)}</small></span>
            <StateTag state={t.state} />
          </button>
        ))}
      </Card>
    </div>
  );
}
