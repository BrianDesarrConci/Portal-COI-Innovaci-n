// Paso 1 · Registrar nueva novedad (baja). granja.html + enviarReporteNovedad (js.html).
import { useMemo, useRef, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { useApp } from '../../../../context/AppContext.jsx';
import { norm, fmt } from '../../../../lib/format.js';
import { Panel, F, PIcon, Avatar, toneOf, gas } from '../kit.jsx';
import { COL, MOTIVOS, hoyISO, fechaCorta } from '../granjaLogic.js';

export default function Registro({ lista, sesion, onDone }) {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [hi, setHi] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [otro, setOtro] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [dias, setDias] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const box = useRef(null);

  // Opciones del selector: "C.C. <cédula> — <nombre> (<oficina>)" como cargarSelectorCajeros.
  const opciones = useMemo(() => lista.filter((f) => String(f[COL.NOMBRE] || '').trim()), [lista]);
  const matches = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const out = [];
    for (const f of opciones) {
      if (norm(f[COL.NOMBRE]).includes(t) || norm(f[COL.OFICINA]).includes(t) || String(f[COL.CEDULA]).includes(q.trim())) out.push(f);
      if (out.length >= 8) break;
    }
    return out;
  }, [q, opciones]);

  const pick = (f) => { setSel(f); setQ(''); setOpen(false); setErr((e) => ({ ...e, cajero: null })); };
  const onKey = (e) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(matches.length - 1, h + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(matches[hi]); }
    if (e.key === 'Escape') setOpen(false);
  };

  const fin = useMemo(() => {
    const n = parseInt(dias, 10);
    if (!fecha || !n || n < 1) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    const ini = new Date(y, m - 1, d), f = new Date(y, m - 1, d + n);
    return { ini, f, n };
  }, [fecha, dias]);

  async function enviar() {
    const descripcion = motivo === 'OTRO' ? otro.trim() : motivo;
    const e = {};
    if (!sel) e.cajero = 'Selecciona un funcionario de la lista.';
    if (!descripcion) e.motivo = motivo === 'OTRO' ? 'Escribe el motivo.' : 'Selecciona un motivo.';
    if (!fecha) e.fecha = 'Indica la fecha de inicio.';
    if (!(parseInt(dias, 10) >= 1)) e.dias = 'Mínimo 1 día.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await gas('registrarNovedad', {
        cajeroNombre: String(sel[COL.NOMBRE]).trim(), oficina: String(sel[COL.OFICINA]).trim(), descripcion,
        fechaInicio: fecha, diasAusencia: dias, reportadoPor: sesion ? sesion.nombre : 'Admin'
      });
      toast(res.msg || 'Proceso terminado');
      if (res.success) { setSel(null); setMotivo(''); setOtro(''); setFecha(hoyISO()); setDias(''); onDone && onDone(res.id); }
    } catch (x) { toast('❌ ' + x.message); } finally { setBusy(false); }
  }

  return (
    <Panel step="1" title="Registrar nueva novedad" sub="Reporta la baja de un funcionario y publica la alerta de reemplazo." tone="gold">
      <div className="v1p-form">
        <F label="Funcionario que reporta baja" req wide error={err.cajero}>
          {sel ? (
            <div className="v1p-picked">
              <Avatar name={sel[COL.NOMBRE]} tone={toneOf(sel[COL.NOMBRE])} />
              <div className="grow">
                <b>{sel[COL.NOMBRE]}</b>
                <small>C.C. {sel[COL.CEDULA]} · {sel[COL.OFICINA]}</small>
                <small className="muted">{[sel[COL.MUNICIPIO], sel[COL.ZONA], sel[COL.CLIENTE]].filter(Boolean).join(' · ')}</small>
              </div>
              <button type="button" className="btn btn-g btn-sm" onClick={() => { setSel(null); setTimeout(() => box.current && box.current.focus(), 0); }}><PIcon name="swap" />Cambiar</button>
            </div>
          ) : (
            <div className="v1p-combo">
              <Icon name="search" />
              <input ref={box} className="inp" value={q} placeholder={`Busca por nombre, cédula u oficina (${fmt(opciones.length)} personas)`} role="combobox" aria-expanded={open && matches.length > 0} aria-autocomplete="list"
                onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey} />
              {open && matches.length > 0 && (
                <ul className="v1p-combo-list" role="listbox">
                  {matches.map((f, i) => (
                    <li key={i} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); pick(f); }} onMouseEnter={() => setHi(i)}>
                      <Avatar name={f[COL.NOMBRE]} tone={toneOf(f[COL.NOMBRE])} size="sm" />
                      <span className="grow"><b>{f[COL.NOMBRE]}</b><small>C.C. {f[COL.CEDULA]} — {f[COL.OFICINA]}</small></span>
                    </li>
                  ))}
                </ul>
              )}
              {open && q.trim() && !matches.length && <div className="v1p-combo-list empty">Sin coincidencias en el directorio.</div>}
            </div>
          )}
        </F>
        <F label="Motivo de la ausencia" req error={err.motivo} wide={motivo === 'OTRO'}>
          <select className="inp" value={motivo} onChange={(e) => { setMotivo(e.target.value); if (e.target.value !== 'OTRO') setOtro(''); }}>
            <option value="">Selecciona un motivo</option>
            {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="OTRO">Otro...</option>
          </select>
          {motivo === 'OTRO' && <input className="inp mt8" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Escriba el motivo..." maxLength={200} autoFocus />}
        </F>
        <F label="Fecha inicio de ausencia" req error={err.fecha}>
          <input className="inp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </F>
        <F label="Días de ausencia" req error={err.dias}>
          <div className="v1p-stepper">
            <button type="button" aria-label="Menos días" onClick={() => setDias((d) => String(Math.max(1, (parseInt(d, 10) || 1) - 1)))}>−</button>
            <input className="inp num" type="number" min="1" inputMode="numeric" placeholder="Ej: 3" value={dias} onChange={(e) => setDias(e.target.value)} />
            <button type="button" aria-label="Más días" onClick={() => setDias((d) => String((parseInt(d, 10) || 0) + 1))}>+</button>
          </div>
        </F>
      </div>
      <div className="v1p-form-foot">
        <div className="v1p-preview">
          <PIcon name="calendar" />
          {fin ? <span>Ausencia desde el <b>{fechaCorta(fin.ini)}</b> por {fin.n} {fin.n === 1 ? 'día' : 'días'}. Si se cubre, la cobertura se cierra sola el <b>{fechaCorta(fin.f)}</b>.</span>
            : <span className="muted">Completa fecha y días para ver el periodo de cobertura.</span>}
        </div>
        <button type="button" className={'btn btn-p btn-lg v1p-cta' + (busy ? ' loading' : '')} onClick={enviar} disabled={busy}>
          <span className="spinner" /><Icon name="bell" />Publicar alerta de reemplazo
        </button>
      </div>
    </Panel>
  );
}
